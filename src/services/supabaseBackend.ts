import { requireSupabase } from '@/lib/supabase'
import { uid } from '@/lib/utils'
import type {
  AppNotification,
  CalendarEvent,
  Comment,
  Habit,
  HabitLog,
  Label,
  Note,
  Profile,
  Project,
  Settings,
  Snapshot,
  Task,
  TaskLabel,
  Workspace,
  WorkspaceMember,
} from '@/types'
import type {
  AuthUser,
  Backend,
  RealtimeChange,
  TableName,
  TableRowMap,
} from './backend'
import { buildSeed, defaultSettings } from './seed'

/**
 * PostgREST's types are normally generated from the database schema. Atlas
 * doesn't ship generated types — the hand-written types in `@/types` are the
 * contract, and `supabase/schema.sql` is what keeps them honest — so partial
 * updates are handed over as plain rows.
 */
type AnyRow = Record<string, unknown>

/** In-app table name → Postgres table name. Only `events` differs. */
const PG: Record<TableName, string> = {
  projects: 'projects',
  tasks: 'tasks',
  labels: 'labels',
  notes: 'notes',
  calendar_events: 'calendar_events',
  habits: 'habits',
  habit_logs: 'habit_logs',
  comments: 'comments',
  notifications: 'notifications',
}

/**
 * Choose which workspace to open, given everything the user can reach.
 *
 * Extracted from the fetch so it can be tested on its own — this is the rule
 * that was wrong before: preferring the owned workspace unconditionally meant
 * an invited member could never reach the workspace they were invited to,
 * because signing up always gives you one of your own.
 */
export function pickWorkspace(
  spaces: Workspace[],
  userId: string,
  preferredId?: string,
): Workspace | null {
  if (!spaces.length) return null
  const preferred = preferredId ? spaces.find((s) => s.id === preferredId) : null
  const owned = spaces.find((s) => s.owner_id === userId)
  return preferred ?? owned ?? spaces[0]
}

export class SupabaseBackend implements Backend {
  readonly kind = 'cloud' as const
  private workspaceId: string | null = null

  async loadSnapshot(user: AuthUser, workspaceId?: string): Promise<Snapshot> {
    const sb = requireSupabase()

    // Keep the profile row in step with the auth record. The DB trigger creates
    // it on signup; this catches display-name changes made later.
    await sb.from('profiles').upsert(
      {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      },
      { onConflict: 'id' },
    )

    const { workspace, workspaces } = await this.resolveWorkspace(user, workspaceId)
    this.workspaceId = workspace.id

    const w = workspace.id
    const [
      members,
      projects,
      tasks,
      labels,
      taskLabels,
      notes,
      events,
      habits,
      habitLogs,
      comments,
      notifications,
      settings,
    ] = await Promise.all([
      sb
        .from('workspace_members')
        .select('*, profile:profiles(*)')
        .eq('workspace_id', w),
      sb.from('projects').select('*').eq('workspace_id', w),
      sb.from('tasks').select('*').eq('workspace_id', w),
      sb.from('labels').select('*').eq('workspace_id', w),
      sb.from('task_labels').select('*'),
      sb.from('notes').select('*').eq('workspace_id', w),
      sb.from('calendar_events').select('*').eq('workspace_id', w),
      sb.from('habits').select('*').eq('workspace_id', w),
      sb.from('habit_logs').select('*').eq('user_id', user.id),
      sb.from('comments').select('*').eq('workspace_id', w),
      sb.from('notifications').select('*').eq('user_id', user.id),
      sb.from('settings').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    const firstError = [
      members,
      projects,
      tasks,
      labels,
      taskLabels,
      notes,
      events,
      habits,
      habitLogs,
      comments,
      notifications,
    ].find((r) => r.error)
    if (firstError?.error) throw firstError.error

    let settingsRow = settings.data as Settings | null
    if (!settingsRow) {
      settingsRow = defaultSettings(user.id)
      await sb.from('settings').upsert(settingsRow)
    }

    return {
      workspace,
      workspaces,
      members: (members.data ?? []) as WorkspaceMember[],
      projects: (projects.data ?? []) as Project[],
      tasks: (tasks.data ?? []) as Task[],
      labels: (labels.data ?? []) as Label[],
      task_labels: (taskLabels.data ?? []) as TaskLabel[],
      notes: (notes.data ?? []) as Note[],
      events: (events.data ?? []) as CalendarEvent[],
      habits: (habits.data ?? []) as Habit[],
      habit_logs: (habitLogs.data ?? []) as HabitLog[],
      comments: (comments.data ?? []) as Comment[],
      notifications: (notifications.data ?? []) as AppNotification[],
      settings: settingsRow,
    }
  }

  /**
   * Work out which workspace to open, and list every one the user can reach.
   *
   * Order of preference: the one explicitly asked for (the switcher's choice,
   * remembered per device), then the one they own, then anything they were
   * invited to. A stale request — an invite since revoked — quietly falls back
   * instead of erroring, because being unable to open the app is far worse than
   * landing in the wrong workspace.
   */
  private async resolveWorkspace(
    user: AuthUser,
    preferredId?: string,
  ): Promise<{ workspace: Workspace; workspaces: Workspace[] }> {
    const sb = requireSupabase()

    const { data: memberships, error } = await sb
      .from('workspace_members')
      .select('workspace:workspaces(*)')
      .eq('user_id', user.id)
    if (error) throw error

    const spaces = (memberships ?? [])
      .map((m) => (m as unknown as { workspace: Workspace | null }).workspace)
      .filter((x): x is Workspace => Boolean(x))

    const chosen = pickWorkspace(spaces, user.id, preferredId)
    if (chosen) {
      return {
        workspace: chosen,
        workspaces: [...spaces].sort((a, b) => a.name.localeCompare(b.name)),
      }
    }

    // First login: create the workspace and fill it with the same starter
    // content local mode gets.
    const workspaceId = uid()
    const seed = buildSeed(user, workspaceId)

    const { data: created, error: wsError } = await sb
      .from('workspaces')
      .insert({ id: workspaceId, name: seed.workspace.name, owner_id: user.id })
      .select()
      .single()
    if (wsError) throw wsError

    await sb
      .from('workspace_members')
      .insert({ workspace_id: workspaceId, user_id: user.id, role: 'owner' })

    // Order matters: projects and labels are referenced by tasks and notes.
    await sb.from('projects').insert(seed.projects)
    await sb.from('labels').insert(seed.labels)
    await sb.from('tasks').insert(seed.tasks)
    await sb.from('task_labels').insert(seed.task_labels)
    await sb.from('notes').insert(seed.notes)
    await sb.from('calendar_events').insert(seed.events)
    await sb.from('habits').insert(seed.habits)
    await sb.from('habit_logs').insert(seed.habit_logs)

    const workspace = created as Workspace
    return { workspace, workspaces: [workspace] }
  }

  async renameWorkspace(id: string, name: string) {
    const { error } = await requireSupabase()
      .from('workspaces')
      .update({ name })
      .eq('id', id)
    if (error) throw error
  }

  async insert<T extends TableName>(table: T, row: TableRowMap[T]) {
    const { error } = await requireSupabase().from(PG[table]).insert(row)
    if (error) throw error
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<TableRowMap[T]>) {
    const { error } = await requireSupabase()
      .from(PG[table])
      .update(patch as AnyRow)
      .eq('id', id)
    if (error) throw error
  }

  async updateMany<T extends TableName>(
    table: T,
    updates: { id: string; patch: Partial<TableRowMap[T]> }[],
  ) {
    // PostgREST has no multi-row UPDATE with differing values, so these go in
    // parallel. Reordering touches at most a handful of rows.
    const sb = requireSupabase()
    const results = await Promise.all(
      updates.map(({ id, patch }) => sb.from(PG[table]).update(patch as AnyRow).eq('id', id)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
  }

  async remove(table: TableName, id: string) {
    const { error } = await requireSupabase().from(PG[table]).delete().eq('id', id)
    if (error) throw error
  }

  async setTaskLabels(taskId: string, labelIds: string[]) {
    const sb = requireSupabase()
    const { error: delError } = await sb.from('task_labels').delete().eq('task_id', taskId)
    if (delError) throw delError
    if (!labelIds.length) return
    const { error } = await sb
      .from('task_labels')
      .insert(labelIds.map((label_id) => ({ task_id: taskId, label_id })))
    if (error) throw error
  }

  async saveSettings(settings: Settings) {
    const { error } = await requireSupabase()
      .from('settings')
      .upsert(settings, { onConflict: 'user_id' })
    if (error) throw error
  }

  async searchProfiles(query: string): Promise<Profile[]> {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .select('*')
      .ilike('email', `%${query}%`)
      .limit(5)
    if (error) throw error
    return (data ?? []) as Profile[]
  }

  /**
   * Add someone to the workspace by email.
   *
   * Client-side lookup only finds people who already have an Atlas account —
   * there is no server to send an invite email from. `invite_member_by_email`
   * is a SECURITY DEFINER function so the lookup can see profiles the caller
   * otherwise can't read.
   */
  async inviteMember(email: string): Promise<WorkspaceMember> {
    const sb = requireSupabase()
    if (!this.workspaceId) throw new Error('No workspace loaded')

    const { data, error } = await sb.rpc('invite_member_by_email', {
      p_workspace_id: this.workspaceId,
      p_email: email.trim().toLowerCase(),
    })
    if (error) throw error
    if (!data) {
      throw new Error(
        `No Atlas account for ${email}. Ask them to sign up first, then invite them again.`,
      )
    }

    const { data: member, error: memberError } = await sb
      .from('workspace_members')
      .select('*, profile:profiles(*)')
      .eq('workspace_id', this.workspaceId)
      .eq('user_id', data as string)
      .single()
    if (memberError) throw memberError
    return member as WorkspaceMember
  }

  async removeMember(userId: string) {
    if (!this.workspaceId) throw new Error('No workspace loaded')
    const { error } = await requireSupabase()
      .from('workspace_members')
      .delete()
      .eq('workspace_id', this.workspaceId)
      .eq('user_id', userId)
    if (error) throw error
  }

  subscribe(workspaceId: string, onChange: (c: RealtimeChange) => void) {
    const sb = requireSupabase()
    const channel = sb.channel(`workspace:${workspaceId}`)

    const scoped: TableName[] = [
      'projects',
      'tasks',
      'labels',
      'notes',
      'calendar_events',
      'habits',
      'comments',
    ]

    for (const table of scoped) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: PG[table],
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) =>
          onChange({
            table,
            type: payload.eventType as RealtimeChange['type'],
            row: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          }),
      )
    }

    // These have no workspace_id column; RLS still scopes what arrives.
    for (const table of ['task_labels', 'workspace_members'] as const) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) =>
          onChange({
            table,
            type: payload.eventType as RealtimeChange['type'],
            row: payload.new as Record<string, unknown>,
            old: payload.old as Record<string, unknown>,
          }),
      )
    }

    channel.subscribe()
    return () => {
      sb.removeChannel(channel)
    }
  }
}

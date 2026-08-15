import { create } from 'zustand'
import { toast } from 'sonner'

import { isCloud } from '@/lib/supabase'
import { nowISO, positionBetween, uid } from '@/lib/utils'
import { toDateOnly } from '@/lib/date'
import type {
  AppNotification,
  CalendarEvent,
  Comment,
  CommentEntity,
  DateOnly,
  Habit,
  Label,
  Note,
  Priority,
  Project,
  Settings,
  Snapshot,
  Subtask,
  Task,
  TaskStatus,
  WorkspaceMember,
  Workspace,
} from '@/types'
import type { AuthUser, Backend, RealtimeChange, TableName } from '@/services/backend'
import { LocalBackend } from '@/services/localBackend'
import { SupabaseBackend } from '@/services/supabaseBackend'

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** Which workspace to reopen next time, per device. */
const WORKSPACE_KEY = 'atlas.workspaceId'

interface DataState extends Omit<Snapshot, 'workspace' | 'settings'> {
  status: Status
  error: string | null
  workspace: Workspace | null
  settings: Settings | null
  user: AuthUser | null
  backend: Backend | null
  /** True while a write is in flight, for subtle "saving…" affordances. */
  syncing: boolean

  load: (user: AuthUser, workspaceId?: string) => Promise<void>
  reset: () => void
  switchWorkspace: (id: string) => Promise<void>
  renameWorkspace: (name: string) => Promise<void>

  createTask: (input: Partial<Task> & { title: string }) => Promise<Task | null>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  moveTask: (id: string, status: TaskStatus, targetIndex: number) => Promise<void>
  scheduleTask: (id: string, start: string, end: string) => Promise<void>
  unscheduleTask: (id: string) => Promise<void>
  setTaskLabels: (taskId: string, labelIds: string[]) => Promise<void>
  addSubtask: (taskId: string, title: string) => Promise<void>
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>
  removeSubtask: (taskId: string, subtaskId: string) => Promise<void>

  createProject: (input: Partial<Project> & { name: string }) => Promise<Project | null>
  updateProject: (id: string, patch: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  createLabel: (name: string, color: string) => Promise<Label | null>
  deleteLabel: (id: string) => Promise<void>

  createNote: (input?: Partial<Note>) => Promise<Note | null>
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>
  deleteNote: (id: string) => Promise<void>

  createEvent: (input: Partial<CalendarEvent> & { title: string; start_at: string; end_at: string }) => Promise<CalendarEvent | null>
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>
  deleteEvent: (id: string) => Promise<void>

  createHabit: (input: Partial<Habit> & { name: string }) => Promise<Habit | null>
  updateHabit: (id: string, patch: Partial<Habit>) => Promise<void>
  deleteHabit: (id: string) => Promise<void>
  logHabit: (habitId: string, date: DateOnly, delta: number) => Promise<void>

  addComment: (entity: CommentEntity, entityId: string, body: string) => Promise<void>
  deleteComment: (id: string) => Promise<void>

  scheduleNotification: (n: Omit<AppNotification, 'id' | 'user_id' | 'created_at'>) => Promise<void>
  markNotificationDelivered: (id: string) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  dismissNotification: (id: string) => Promise<void>

  updateSettings: (patch: Partial<Settings>) => Promise<void>

  inviteMember: (email: string) => Promise<void>
  removeMember: (userId: string) => Promise<void>

  applyRemote: (change: RealtimeChange) => void
}

const EMPTY = {
  workspaces: [] as Workspace[],
  members: [] as WorkspaceMember[],
  projects: [] as Project[],
  tasks: [] as Task[],
  labels: [] as Label[],
  task_labels: [] as Snapshot['task_labels'],
  notes: [] as Note[],
  events: [] as CalendarEvent[],
  habits: [] as Habit[],
  habit_logs: [] as Snapshot['habit_logs'],
  comments: [] as Comment[],
  notifications: [] as AppNotification[],
}

/** Which state key holds each table's rows. */
const STATE_KEY: Record<TableName, Exclude<keyof typeof EMPTY, 'workspaces'>> = {
  projects: 'projects',
  tasks: 'tasks',
  labels: 'labels',
  notes: 'notes',
  calendar_events: 'events',
  habits: 'habits',
  habit_logs: 'habit_logs',
  comments: 'comments',
  notifications: 'notifications',
}

export const useData = create<DataState>((set, get) => {
  /**
   * Every mutation is optimistic: state changes now, the write happens after,
   * and a failure puts the old rows back and says so. On a phone with patchy
   * signal this is the difference between an app that feels instant and one
   * that feels broken.
   */
  async function commit<K extends keyof typeof EMPTY>(
    keys: K[],
    apply: () => void,
    remote: (backend: Backend) => Promise<void>,
  ) {
    const backend = get().backend
    const before = Object.fromEntries(keys.map((k) => [k, get()[k]])) as Pick<
      DataState,
      K
    >
    apply()
    if (!backend) return
    set({ syncing: true })
    try {
      await remote(backend)
    } catch (err) {
      set({ ...before, syncing: false } as Partial<DataState>)
      toast.error((err as Error).message || 'Could not save that change')
      return
    }
    set({ syncing: false })
  }

  const base = () => {
    const { workspace, user } = get()
    if (!workspace || !user) return null
    return { workspace_id: workspace.id, created_by: user.id }
  }

  /** Next position at the end of a Kanban column. */
  const endPosition = (status: TaskStatus) => {
    const inColumn = get().tasks.filter((t) => t.status === status)
    return inColumn.length ? Math.max(...inColumn.map((t) => t.position)) + 1000 : 1000
  }

  return {
    ...EMPTY,
    status: 'idle',
    error: null,
    workspace: null,
    settings: null,
    user: null,
    backend: null,
    syncing: false,

    async load(user, workspaceId) {
      set({ status: 'loading', error: null, user })
      const backend: Backend = isCloud ? new SupabaseBackend() : new LocalBackend()
      const wanted = workspaceId ?? localStorage.getItem(WORKSPACE_KEY) ?? undefined
      try {
        const snap = await backend.loadSnapshot(user, wanted)
        // Store what we actually got, not what we asked for — the backend may
        // have fallen back if the requested workspace is no longer reachable.
        localStorage.setItem(WORKSPACE_KEY, snap.workspace.id)
        set({
          ...snap,
          backend,
          status: 'ready',
          error: null,
        })
      } catch (err) {
        set({ status: 'error', error: (err as Error).message })
      }
    },

    /**
     * Reopen everything against a different workspace.
     *
     * A full reload rather than a partial swap: every array in the store is
     * scoped to one workspace, so re-fetching is both simpler and less likely
     * to leave one list showing the previous workspace's rows.
     */
    async switchWorkspace(id) {
      const { user, workspace } = get()
      if (!user || !id || id === workspace?.id) return
      await get().load(user, id)
    },

    async renameWorkspace(name) {
      const { workspace, backend } = get()
      const next = name.trim()
      if (!workspace || !backend || !next || next === workspace.name) return
      const before = { workspace, workspaces: get().workspaces }
      const updated = { ...workspace, name: next }
      set({
        workspace: updated,
        workspaces: get().workspaces.map((w) => (w.id === workspace.id ? updated : w)),
      })
      try {
        await backend.renameWorkspace(workspace.id, next)
      } catch (err) {
        set(before)
        toast.error((err as Error).message)
      }
    },

    reset() {
      set({ ...EMPTY, status: 'idle', workspace: null, settings: null, user: null, backend: null })
    },

    // ---------------------------------------------------------------- tasks

    async createTask(input) {
      const b = base()
      if (!b) return null
      const status = input.status ?? 'inbox'
      const task: Task = {
        id: uid(),
        project_id: null,
        description: null,
        status,
        priority: 4,
        due_date: null,
        scheduled_start: null,
        scheduled_end: null,
        estimate_minutes: null,
        subtasks: [],
        position: endPosition(status),
        completed_at: null,
        is_private: false,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...b,
        ...input,
      }
      await commit(
        ['tasks'],
        () => set({ tasks: [...get().tasks, task] }),
        (backend) => backend.insert('tasks', task),
      )
      return task
    },

    async updateTask(id, patch) {
      const next = { ...patch, updated_at: nowISO() }
      await commit(
        ['tasks'],
        () => set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...next } : t)) }),
        (backend) => backend.update('tasks', id, next),
      )
    },

    async deleteTask(id) {
      await commit(
        ['tasks', 'task_labels', 'events'],
        () =>
          set({
            tasks: get().tasks.filter((t) => t.id !== id),
            task_labels: get().task_labels.filter((tl) => tl.task_id !== id),
            events: get().events.filter((e) => e.task_id !== id),
          }),
        (backend) => backend.remove('tasks', id),
      )
    },

    async toggleTask(id) {
      const task = get().tasks.find((t) => t.id === id)
      if (!task) return
      const done = task.status === 'done'
      // Un-completing sends a task back to Today, which is nearly always what
      // you meant if you ticked it by mistake.
      await get().updateTask(id, {
        status: done ? 'today' : 'done',
        completed_at: done ? null : nowISO(),
      })
    },

    async moveTask(id, status, targetIndex) {
      const task = get().tasks.find((t) => t.id === id)
      if (!task) return

      const column = get()
        .tasks.filter((t) => t.status === status && t.id !== id)
        .sort((a, b) => a.position - b.position)

      const before = column[targetIndex - 1]?.position ?? null
      const after = column[targetIndex]?.position ?? null
      const position = positionBetween(before, after)

      const patch: Partial<Task> = {
        status,
        position,
        updated_at: nowISO(),
        completed_at: status === 'done' ? (task.completed_at ?? nowISO()) : null,
      }

      await commit(
        ['tasks'],
        () => set({ tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
        (backend) => backend.update('tasks', id, patch),
      )
    },

    /** Scheduling a task also puts a mirror event on the calendar. */
    async scheduleTask(id, start, end) {
      const b = base()
      const task = get().tasks.find((t) => t.id === id)
      if (!b || !task) return

      const existing = get().events.find((e) => e.task_id === id)
      const project = get().projects.find((p) => p.id === task.project_id)
      const patch: Partial<Task> = {
        scheduled_start: start,
        scheduled_end: end,
        updated_at: nowISO(),
      }

      if (existing) {
        await commit(
          ['tasks', 'events'],
          () =>
            set({
              tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
              events: get().events.map((e) =>
                e.id === existing.id ? { ...e, start_at: start, end_at: end } : e,
              ),
            }),
          async (backend) => {
            await backend.update('tasks', id, patch)
            await backend.update('calendar_events', existing.id, {
              start_at: start,
              end_at: end,
              updated_at: nowISO(),
            })
          },
        )
        return
      }

      const event: CalendarEvent = {
        id: uid(),
        project_id: task.project_id,
        task_id: id,
        title: task.title,
        description: null,
        start_at: start,
        end_at: end,
        all_day: false,
        color: project?.color ?? null,
        location: null,
        is_private: task.is_private,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...b,
      }

      await commit(
        ['tasks', 'events'],
        () =>
          set({
            tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
            events: [...get().events, event],
          }),
        async (backend) => {
          await backend.update('tasks', id, patch)
          await backend.insert('calendar_events', event)
        },
      )
    },

    async unscheduleTask(id) {
      const existing = get().events.find((e) => e.task_id === id)
      const patch: Partial<Task> = {
        scheduled_start: null,
        scheduled_end: null,
        updated_at: nowISO(),
      }
      await commit(
        ['tasks', 'events'],
        () =>
          set({
            tasks: get().tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
            events: get().events.filter((e) => e.task_id !== id),
          }),
        async (backend) => {
          await backend.update('tasks', id, patch)
          if (existing) await backend.remove('calendar_events', existing.id)
        },
      )
    },

    async setTaskLabels(taskId, labelIds) {
      await commit(
        ['task_labels'],
        () =>
          set({
            task_labels: [
              ...get().task_labels.filter((tl) => tl.task_id !== taskId),
              ...labelIds.map((label_id) => ({ task_id: taskId, label_id })),
            ],
          }),
        (backend) => backend.setTaskLabels(taskId, labelIds),
      )
    },

    async addSubtask(taskId, title) {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task || !title.trim()) return
      const subtask: Subtask = { id: uid(), title: title.trim(), done: false }
      await get().updateTask(taskId, { subtasks: [...task.subtasks, subtask] })
    },

    async toggleSubtask(taskId, subtaskId) {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task) return
      await get().updateTask(taskId, {
        subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
      })
    },

    async removeSubtask(taskId, subtaskId) {
      const task = get().tasks.find((t) => t.id === taskId)
      if (!task) return
      await get().updateTask(taskId, {
        subtasks: task.subtasks.filter((s) => s.id !== subtaskId),
      })
    },

    // ------------------------------------------------------------- projects

    async createProject(input) {
      const b = base()
      if (!b) return null
      const project: Project = {
        id: uid(),
        description: null,
        color: 'oklch(65% 0.16 258)',
        icon: 'Folder',
        archived: false,
        is_private: false,
        position: (get().projects.length + 1) * 1000,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...b,
        ...input,
      }
      await commit(
        ['projects'],
        () => set({ projects: [...get().projects, project] }),
        (backend) => backend.insert('projects', project),
      )
      return project
    },

    async updateProject(id, patch) {
      const next = { ...patch, updated_at: nowISO() }
      await commit(
        ['projects'],
        () => set({ projects: get().projects.map((p) => (p.id === id ? { ...p, ...next } : p)) }),
        (backend) => backend.update('projects', id, next),
      )
    },

    /** Deleting a project keeps its tasks and notes; they fall back to no project. */
    async deleteProject(id) {
      await commit(
        ['projects', 'tasks', 'notes', 'events'],
        () =>
          set({
            projects: get().projects.filter((p) => p.id !== id),
            tasks: get().tasks.map((t) => (t.project_id === id ? { ...t, project_id: null } : t)),
            notes: get().notes.map((n) => (n.project_id === id ? { ...n, project_id: null } : n)),
            events: get().events.map((e) =>
              e.project_id === id ? { ...e, project_id: null } : e,
            ),
          }),
        (backend) => backend.remove('projects', id),
      )
    },

    // --------------------------------------------------------------- labels

    async createLabel(name, color) {
      const b = base()
      if (!b) return null
      const label: Label = {
        id: uid(),
        workspace_id: b.workspace_id,
        name: name.trim(),
        color,
        created_at: nowISO(),
      }
      await commit(
        ['labels'],
        () => set({ labels: [...get().labels, label] }),
        (backend) => backend.insert('labels', label),
      )
      return label
    },

    async deleteLabel(id) {
      await commit(
        ['labels', 'task_labels'],
        () =>
          set({
            labels: get().labels.filter((l) => l.id !== id),
            task_labels: get().task_labels.filter((tl) => tl.label_id !== id),
          }),
        (backend) => backend.remove('labels', id),
      )
    },

    // ---------------------------------------------------------------- notes

    async createNote(input = {}) {
      const b = base()
      if (!b) return null
      const note: Note = {
        id: uid(),
        project_id: null,
        title: 'Untitled',
        content: '',
        pinned: false,
        is_private: false,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...b,
        ...input,
      }
      await commit(
        ['notes'],
        () => set({ notes: [...get().notes, note] }),
        (backend) => backend.insert('notes', note),
      )
      return note
    },

    async updateNote(id, patch) {
      const next = { ...patch, updated_at: nowISO() }
      await commit(
        ['notes'],
        () => set({ notes: get().notes.map((n) => (n.id === id ? { ...n, ...next } : n)) }),
        (backend) => backend.update('notes', id, next),
      )
    },

    async deleteNote(id) {
      await commit(
        ['notes'],
        () => set({ notes: get().notes.filter((n) => n.id !== id) }),
        (backend) => backend.remove('notes', id),
      )
    },

    // --------------------------------------------------------------- events

    async createEvent(input) {
      const b = base()
      if (!b) return null
      const event: CalendarEvent = {
        id: uid(),
        project_id: null,
        task_id: null,
        description: null,
        all_day: false,
        color: null,
        location: null,
        is_private: false,
        created_at: nowISO(),
        updated_at: nowISO(),
        ...b,
        ...input,
      }
      await commit(
        ['events'],
        () => set({ events: [...get().events, event] }),
        (backend) => backend.insert('calendar_events', event),
      )
      return event
    },

    async updateEvent(id, patch) {
      const next = { ...patch, updated_at: nowISO() }
      const event = get().events.find((e) => e.id === id)
      // Keep a scheduled task's own times in step when its event moves.
      const taskPatch =
        event?.task_id && (patch.start_at || patch.end_at)
          ? {
              scheduled_start: patch.start_at ?? event.start_at,
              scheduled_end: patch.end_at ?? event.end_at,
            }
          : null

      await commit(
        ['events', 'tasks'],
        () =>
          set({
            events: get().events.map((e) => (e.id === id ? { ...e, ...next } : e)),
            tasks: taskPatch
              ? get().tasks.map((t) => (t.id === event!.task_id ? { ...t, ...taskPatch } : t))
              : get().tasks,
          }),
        async (backend) => {
          await backend.update('calendar_events', id, next)
          if (taskPatch && event?.task_id) await backend.update('tasks', event.task_id, taskPatch)
        },
      )
    },

    async deleteEvent(id) {
      const event = get().events.find((e) => e.id === id)
      await commit(
        ['events', 'tasks'],
        () =>
          set({
            events: get().events.filter((e) => e.id !== id),
            tasks: event?.task_id
              ? get().tasks.map((t) =>
                  t.id === event.task_id
                    ? { ...t, scheduled_start: null, scheduled_end: null }
                    : t,
                )
              : get().tasks,
          }),
        async (backend) => {
          await backend.remove('calendar_events', id)
          if (event?.task_id) {
            await backend.update('tasks', event.task_id, {
              scheduled_start: null,
              scheduled_end: null,
            })
          }
        },
      )
    },

    // --------------------------------------------------------------- habits

    async createHabit(input) {
      const b = base()
      if (!b) return null
      const habit: Habit = {
        id: uid(),
        icon: 'Circle',
        color: 'oklch(70% 0.15 258)',
        target_per_day: 1,
        unit: null,
        archived: false,
        position: (get().habits.length + 1) * 1000,
        created_at: nowISO(),
        ...b,
        ...input,
      }
      await commit(
        ['habits'],
        () => set({ habits: [...get().habits, habit] }),
        (backend) => backend.insert('habits', habit),
      )
      return habit
    },

    async updateHabit(id, patch) {
      await commit(
        ['habits'],
        () => set({ habits: get().habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) }),
        (backend) => backend.update('habits', id, patch),
      )
    },

    async deleteHabit(id) {
      await commit(
        ['habits', 'habit_logs'],
        () =>
          set({
            habits: get().habits.filter((h) => h.id !== id),
            habit_logs: get().habit_logs.filter((l) => l.habit_id !== id),
          }),
        (backend) => backend.remove('habits', id),
      )
    },

    /** `delta` of +1 ticks one unit; a negative delta undoes it. Clamped at 0. */
    async logHabit(habitId, date, delta) {
      const user = get().user
      if (!user) return
      const existing = get().habit_logs.find((l) => l.habit_id === habitId && l.date === date)

      if (!existing) {
        if (delta <= 0) return
        const log = { id: uid(), habit_id: habitId, user_id: user.id, date, count: delta }
        await commit(
          ['habit_logs'],
          () => set({ habit_logs: [...get().habit_logs, log] }),
          (backend) => backend.insert('habit_logs', log),
        )
        return
      }

      const count = Math.max(0, existing.count + delta)
      if (count === 0) {
        await commit(
          ['habit_logs'],
          () => set({ habit_logs: get().habit_logs.filter((l) => l.id !== existing.id) }),
          (backend) => backend.remove('habit_logs', existing.id),
        )
        return
      }
      await commit(
        ['habit_logs'],
        () =>
          set({
            habit_logs: get().habit_logs.map((l) =>
              l.id === existing.id ? { ...l, count } : l,
            ),
          }),
        (backend) => backend.update('habit_logs', existing.id, { count }),
      )
    },

    // ------------------------------------------------------------- comments

    async addComment(entity, entityId, body) {
      const b = base()
      if (!b || !body.trim()) return
      const comment: Comment = {
        id: uid(),
        entity_type: entity,
        entity_id: entityId,
        body: body.trim(),
        created_at: nowISO(),
        ...b,
      }
      await commit(
        ['comments'],
        () => set({ comments: [...get().comments, comment] }),
        (backend) => backend.insert('comments', comment),
      )
    },

    async deleteComment(id) {
      await commit(
        ['comments'],
        () => set({ comments: get().comments.filter((c) => c.id !== id) }),
        (backend) => backend.remove('comments', id),
      )
    },

    // -------------------------------------------------------- notifications

    async scheduleNotification(input) {
      const user = get().user
      if (!user) return
      const n: AppNotification = {
        id: uid(),
        user_id: user.id,
        created_at: nowISO(),
        ...input,
      }
      await commit(
        ['notifications'],
        () => set({ notifications: [...get().notifications, n] }),
        (backend) => backend.insert('notifications', n),
      )
    },

    async markNotificationDelivered(id) {
      const delivered_at = nowISO()
      await commit(
        ['notifications'],
        () =>
          set({
            notifications: get().notifications.map((n) =>
              n.id === id ? { ...n, delivered_at } : n,
            ),
          }),
        (backend) => backend.update('notifications', id, { delivered_at }),
      )
    },

    async markNotificationRead(id) {
      const read_at = nowISO()
      await commit(
        ['notifications'],
        () =>
          set({
            notifications: get().notifications.map((n) => (n.id === id ? { ...n, read_at } : n)),
          }),
        (backend) => backend.update('notifications', id, { read_at }),
      )
    },

    async dismissNotification(id) {
      await commit(
        ['notifications'],
        () => set({ notifications: get().notifications.filter((n) => n.id !== id) }),
        (backend) => backend.remove('notifications', id),
      )
    },

    // ------------------------------------------------------------- settings

    async updateSettings(patch) {
      const current = get().settings
      if (!current) return
      const next: Settings = { ...current, ...patch, updated_at: nowISO() }
      await commit(
        [],
        () => set({ settings: next }),
        (backend) => backend.saveSettings(next),
      )
    },

    // -------------------------------------------------------------- members

    /**
     * Pairing is mutual: they join your workspace and you join theirs. So this
     * also refreshes the workspace list, otherwise the switcher wouldn't show
     * the one you just gained access to until the next reload.
     */
    async inviteMember(email) {
      const { backend, user } = get()
      if (!backend || !user) return
      try {
        const member = await backend.inviteMember(email)
        set({ members: [...get().members.filter((m) => m.user_id !== member.user_id), member] })
        const who = member.profile?.display_name ?? member.profile?.email ?? email
        toast.success(`Now sharing with ${who}`, {
          description: 'You can switch between both workspaces from the sidebar.',
        })
        set({ workspaces: await backend.listWorkspaces(user.id) })
      } catch (err) {
        toast.error((err as Error).message)
      }
    },

    async removeMember(userId) {
      const { backend, user } = get()
      if (!backend || !user) return
      const before = get().members
      set({ members: before.filter((m) => m.user_id !== userId) })
      try {
        await backend.removeMember(userId)
        // Their workspace disappears from the switcher at the same time.
        set({ workspaces: await backend.listWorkspaces(user.id) })
      } catch (err) {
        set({ members: before })
        toast.error((err as Error).message)
      }
    },

    // ------------------------------------------------------------- realtime

    /**
     * Fold a change from another client into state.
     *
     * Applied as an upsert keyed by id, so our own echoed writes are harmless
     * no-ops rather than duplicates.
     */
    applyRemote(change) {
      const { table, type, row, old } = change

      if (table === 'task_labels') {
        const link = (type === 'DELETE' ? old : row) as { task_id: string; label_id: string }
        if (!link?.task_id) return
        const rest = get().task_labels.filter(
          (tl) => !(tl.task_id === link.task_id && tl.label_id === link.label_id),
        )
        set({ task_labels: type === 'DELETE' ? rest : [...rest, link] })
        return
      }

      if (table === 'workspace_members') {
        const member = (type === 'DELETE' ? old : row) as unknown as WorkspaceMember
        if (!member?.user_id) return
        const rest = get().members.filter((m) => m.user_id !== member.user_id)
        // The realtime payload has no joined profile; keep the one we had.
        const previous = get().members.find((m) => m.user_id === member.user_id)
        set({
          members:
            type === 'DELETE'
              ? rest
              : [...rest, { ...member, profile: previous?.profile ?? null }],
        })
        return
      }

      const key = STATE_KEY[table]
      const list = get()[key] as { id: string }[]
      const incoming = (type === 'DELETE' ? old : row) as { id: string }
      if (!incoming?.id) return

      if (type === 'DELETE') {
        set({ [key]: list.filter((r) => r.id !== incoming.id) } as Partial<DataState>)
        return
      }
      const exists = list.some((r) => r.id === incoming.id)
      set({
        [key]: exists
          ? list.map((r) => (r.id === incoming.id ? { ...r, ...incoming } : r))
          : [...list, incoming],
      } as Partial<DataState>)
    },
  }
})

// Debug handle, development only.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).__atlas = useData
}

/** Convenience for the quick-capture bar: parses nothing, just files to Inbox. */
export function quickAdd(title: string, extra: Partial<Task> = {}) {
  return useData.getState().createTask({ title, status: 'inbox', ...extra })
}

export { toDateOnly }
export type { Priority, TaskStatus }

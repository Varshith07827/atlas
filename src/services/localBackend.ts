import { uid } from '@/lib/utils'
import type { Settings, Snapshot } from '@/types'
import {
  UnsupportedInLocalMode,
  type AuthUser,
  type Backend,
  type RealtimeChange,
  type TableName,
  type TableRowMap,
} from './backend'
import { buildSeed } from './seed'

const KEY = 'atlas.local.v1'

/**
 * localStorage-backed backend.
 *
 * Writes are synchronous and whole-snapshot: at personal scale the entire
 * dataset is a few hundred kilobytes, and rewriting it costs less than the
 * bookkeeping needed to write it incrementally. Realtime is a no-op — there is
 * only ever one client.
 */
export class LocalBackend implements Backend {
  readonly kind = 'local' as const
  private snapshot: Snapshot | null = null

  async loadSnapshot(user: AuthUser): Promise<Snapshot> {
    // Local mode has exactly one workspace; `workspaceId` is ignored.
    const raw = localStorage.getItem(KEY)
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Snapshot
        // Tolerate snapshots written by older builds that lack newer arrays.
        this.snapshot = {
          ...buildEmptyShape(user, parsed.workspace?.id ?? uid()),
          ...parsed,
        }
        // Snapshots written before workspace switching existed have no list.
        if (!this.snapshot.workspaces?.length) {
          this.snapshot.workspaces = [this.snapshot.workspace]
        }
        return this.snapshot
      } catch {
        // Corrupt payload: keep a copy for forensics rather than silently
        // destroying whatever the user had.
        localStorage.setItem(`${KEY}.corrupt.${Date.now()}`, raw)
      }
    }
    this.snapshot = buildSeed(user, uid())
    this.flush()
    return this.snapshot
  }

  private flush() {
    if (!this.snapshot) return
    try {
      localStorage.setItem(KEY, JSON.stringify(this.snapshot))
    } catch (err) {
      // Quota exceeded is the realistic failure here; surfacing it beats
      // pretending the write succeeded.
      throw new Error(
        `Could not save locally (${(err as Error).message}). Free some space or connect Supabase.`,
      )
    }
  }

  private table<T extends TableName>(t: T): TableRowMap[T][] {
    const s = this.snapshot
    if (!s) throw new Error('Snapshot not loaded')
    const map: Record<TableName, unknown[]> = {
      projects: s.projects,
      tasks: s.tasks,
      labels: s.labels,
      notes: s.notes,
      calendar_events: s.events,
      habits: s.habits,
      habit_logs: s.habit_logs,
      comments: s.comments,
      notifications: s.notifications,
    }
    return map[t] as TableRowMap[T][]
  }

  async insert<T extends TableName>(t: T, row: TableRowMap[T]) {
    this.table(t).push(row)
    this.flush()
  }

  async update<T extends TableName>(t: T, id: string, patch: Partial<TableRowMap[T]>) {
    const rows = this.table(t)
    const i = rows.findIndex((r) => (r as { id: string }).id === id)
    if (i >= 0) rows[i] = { ...rows[i], ...patch }
    this.flush()
  }

  async updateMany<T extends TableName>(
    t: T,
    updates: { id: string; patch: Partial<TableRowMap[T]> }[],
  ) {
    const rows = this.table(t)
    for (const { id, patch } of updates) {
      const i = rows.findIndex((r) => (r as { id: string }).id === id)
      if (i >= 0) rows[i] = { ...rows[i], ...patch }
    }
    this.flush()
  }

  async remove(t: TableName, id: string) {
    const rows = this.table(t)
    const i = rows.findIndex((r) => (r as { id: string }).id === id)
    if (i >= 0) rows.splice(i, 1)
    if (t === 'tasks' && this.snapshot) {
      this.snapshot.task_labels = this.snapshot.task_labels.filter((tl) => tl.task_id !== id)
    }
    this.flush()
  }

  async setTaskLabels(taskId: string, labelIds: string[]) {
    if (!this.snapshot) return
    this.snapshot.task_labels = [
      ...this.snapshot.task_labels.filter((tl) => tl.task_id !== taskId),
      ...labelIds.map((label_id) => ({ task_id: taskId, label_id })),
    ]
    this.flush()
  }

  async saveSettings(settings: Settings) {
    if (!this.snapshot) return
    this.snapshot.settings = settings
    this.flush()
  }

  async renameWorkspace(_id: string, name: string) {
    if (!this.snapshot) return
    this.snapshot.workspace = { ...this.snapshot.workspace, name }
    this.snapshot.workspaces = [this.snapshot.workspace]
    this.flush()
  }

  async listWorkspaces() {
    return this.snapshot ? [this.snapshot.workspace] : []
  }

  async inviteMember(): Promise<never> {
    throw new UnsupportedInLocalMode('Inviting someone')
  }

  async removeMember(): Promise<never> {
    throw new UnsupportedInLocalMode('Managing members')
  }

  async searchProfiles() {
    return []
  }

  subscribe(_workspaceId: string, _onChange: (c: RealtimeChange) => void) {
    return () => {}
  }

  /** Used by Settings → "Reset local data". */
  static wipe() {
    localStorage.removeItem(KEY)
  }
}

function buildEmptyShape(user: AuthUser, workspaceId: string): Snapshot {
  const seed = buildSeed(user, workspaceId)
  return {
    ...seed,
    projects: [],
    tasks: [],
    labels: [],
    task_labels: [],
    notes: [],
    events: [],
    habits: [],
    habit_logs: [],
    comments: [],
    notifications: [],
  }
}

import type {
  AppNotification,
  Workspace,
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
  WorkspaceMember,
} from '@/types'

/** Tables that have a plain `id` primary key and share the generic CRUD path. */
export interface TableRowMap {
  projects: Project
  tasks: Task
  labels: Label
  notes: Note
  calendar_events: CalendarEvent
  habits: Habit
  habit_logs: HabitLog
  comments: Comment
  notifications: AppNotification
}

export type TableName = keyof TableRowMap

export const TABLE_NAMES: TableName[] = [
  'projects',
  'tasks',
  'labels',
  'notes',
  'calendar_events',
  'habits',
  'habit_logs',
  'comments',
  'notifications',
]

export interface RealtimeChange {
  table: TableName | 'task_labels' | 'workspace_members'
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  row: Record<string, unknown>
  old: Record<string, unknown>
}

export interface AuthUser {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
}

/**
 * The one seam between Atlas and where its data lives.
 *
 * `LocalBackend` keeps everything in this browser; `SupabaseBackend` talks to
 * Postgres. The store above only ever sees this interface, which is why the
 * whole app works before you have created a Supabase project — and why turning
 * the cloud on later changes no feature code.
 */
export interface Backend {
  readonly kind: 'local' | 'cloud'

  /**
   * Fetch (or create, on first run) everything the app holds in memory.
   *
   * `workspaceId` picks which workspace to open. It is a preference, not a
   * demand: if the user is no longer a member of it (an invite was revoked,
   * say) the backend falls back to one they can actually reach rather than
   * failing to load.
   */
  loadSnapshot(user: AuthUser, workspaceId?: string): Promise<Snapshot>

  insert<T extends TableName>(table: T, row: TableRowMap[T]): Promise<void>
  update<T extends TableName>(
    table: T,
    id: string,
    patch: Partial<TableRowMap[T]>,
  ): Promise<void>
  remove(table: TableName, id: string): Promise<void>
  /** Bulk update, used by drag-and-drop reordering. */
  updateMany<T extends TableName>(
    table: T,
    rows: { id: string; patch: Partial<TableRowMap[T]> }[],
  ): Promise<void>

  /** Replaces the label set of a task in one round trip. */
  setTaskLabels(taskId: string, labelIds: string[]): Promise<void>

  saveSettings(settings: Settings): Promise<void>

  /** Rename a workspace. Owner only — the database enforces that too. */
  renameWorkspace(id: string, name: string): Promise<void>

  /** Every workspace the user can reach, for the switcher. */
  listWorkspaces(userId: string): Promise<Workspace[]>

  /** Workspace sharing. Local mode reports these as unsupported. */
  inviteMember(email: string): Promise<WorkspaceMember>
  removeMember(userId: string): Promise<void>
  searchProfiles(query: string): Promise<Profile[]>

  /** Live updates from other clients. Returns an unsubscribe function. */
  subscribe(workspaceId: string, onChange: (c: RealtimeChange) => void): () => void
}

export class UnsupportedInLocalMode extends Error {
  constructor(what: string) {
    super(`${what} needs a Supabase project — Atlas is running in local mode.`)
    this.name = 'UnsupportedInLocalMode'
  }
}

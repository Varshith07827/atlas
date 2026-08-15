/**
 * Domain types.
 *
 * These deliberately mirror the Postgres column names (snake_case) one-for-one.
 * Atlas has no server, so every row travels straight from PostgREST into React
 * state; a camelCase mapping layer would only add a place for bugs to hide.
 */

export type UUID = string
/** `YYYY-MM-DD`, always in the user's local calendar. */
export type DateOnly = string
/** Full ISO-8601 timestamp with zone. */
export type Timestamp = string

export type TaskStatus = 'inbox' | 'today' | 'doing' | 'done'

export const TASK_STATUSES: TaskStatus[] = ['inbox', 'today', 'doing', 'done']

export const STATUS_LABEL: Record<TaskStatus, string> = {
  inbox: 'Inbox',
  today: 'Today',
  doing: 'Doing',
  done: 'Done',
}

/** 1 = urgent … 4 = none. Matches the p1–p4 convention people already know. */
export type Priority = 1 | 2 | 3 | 4

export const PRIORITY_LABEL: Record<Priority, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'None',
}

export const PRIORITY_COLOR: Record<Priority, string> = {
  1: 'var(--color-p1)',
  2: 'var(--color-p2)',
  3: 'var(--color-p3)',
  4: 'var(--color-p4)',
}

export type Role = 'owner' | 'member'

export interface Profile {
  id: UUID
  email: string
  display_name: string | null
  avatar_url: string | null
  created_at: Timestamp
}

export interface Workspace {
  id: UUID
  name: string
  owner_id: UUID
  created_at: Timestamp
}

export interface WorkspaceMember {
  workspace_id: UUID
  user_id: UUID
  role: Role
  created_at: Timestamp
  /** Joined from `profiles` for display; not a real column. */
  profile?: Profile | null
}

export interface Project {
  id: UUID
  workspace_id: UUID
  name: string
  description: string | null
  color: string
  icon: string | null
  archived: boolean
  /** Private projects are visible only to `created_by`, even to workspace mates. */
  is_private: boolean
  position: number
  created_by: UUID
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Task {
  id: UUID
  workspace_id: UUID
  project_id: UUID | null
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  due_date: DateOnly | null
  /** Set when the task has been dragged onto the calendar. */
  scheduled_start: Timestamp | null
  scheduled_end: Timestamp | null
  estimate_minutes: number | null
  subtasks: Subtask[]
  /** Fractional index within a Kanban column, so reordering touches one row. */
  position: number
  completed_at: Timestamp | null
  is_private: boolean
  created_by: UUID
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Label {
  id: UUID
  workspace_id: UUID
  name: string
  color: string
  created_at: Timestamp
}

export interface TaskLabel {
  task_id: UUID
  label_id: UUID
}

export interface Note {
  id: UUID
  workspace_id: UUID
  project_id: UUID | null
  title: string
  /** Markdown. */
  content: string
  pinned: boolean
  is_private: boolean
  created_by: UUID
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CalendarEvent {
  id: UUID
  workspace_id: UUID
  project_id: UUID | null
  /** Set when the event was created by scheduling a task. */
  task_id: UUID | null
  title: string
  description: string | null
  start_at: Timestamp
  end_at: Timestamp
  all_day: boolean
  color: string | null
  location: string | null
  is_private: boolean
  created_by: UUID
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Habit {
  id: UUID
  workspace_id: UUID
  name: string
  icon: string
  color: string
  /** How many times a day counts as "done" (e.g. 8 glasses of water). */
  target_per_day: number
  unit: string | null
  archived: boolean
  position: number
  created_by: UUID
  created_at: Timestamp
}

export interface HabitLog {
  id: UUID
  habit_id: UUID
  user_id: UUID
  date: DateOnly
  count: number
}

export type CommentEntity = 'task' | 'note' | 'project'

export interface Comment {
  id: UUID
  workspace_id: UUID
  entity_type: CommentEntity
  entity_id: UUID
  body: string
  created_by: UUID
  created_at: Timestamp
}

export interface AppNotification {
  id: UUID
  user_id: UUID
  task_id: UUID | null
  title: string
  body: string | null
  fire_at: Timestamp
  read_at: Timestamp | null
  /** Set once the browser notification has actually been shown. */
  delivered_at: Timestamp | null
  created_at: Timestamp
}

export type ThemeMode = 'dark' | 'light' | 'system'

export interface Settings {
  user_id: UUID
  theme: ThemeMode
  accent: string
  week_start: 0 | 1
  notifications_enabled: boolean
  notify_due_today: boolean
  notify_deadlines: boolean
  /** Minutes before `scheduled_start` to fire a reminder. */
  reminder_lead_minutes: number
  default_calendar_view: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'
  updated_at: Timestamp
}

/** Everything the app holds in memory. One fetch fills all of it. */
export interface Snapshot {
  /** The workspace currently being viewed. */
  workspace: Workspace
  /** Every workspace this user can reach — their own plus any they were invited to. */
  workspaces: Workspace[]
  members: WorkspaceMember[]
  projects: Project[]
  tasks: Task[]
  labels: Label[]
  task_labels: TaskLabel[]
  notes: Note[]
  events: CalendarEvent[]
  habits: Habit[]
  habit_logs: HabitLog[]
  comments: Comment[]
  notifications: AppNotification[]
  settings: Settings
}

export type SearchHit =
  | { kind: 'task'; id: UUID; title: string; subtitle: string; task: Task }
  | { kind: 'note'; id: UUID; title: string; subtitle: string; note: Note }
  | { kind: 'project'; id: UUID; title: string; subtitle: string; project: Project }
  | {
      kind: 'event'
      id: UUID
      title: string
      subtitle: string
      event: CalendarEvent
    }

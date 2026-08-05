import { currentStreak, fromDateOnly, isOverdue, today, toDateOnly } from '@/lib/date'
import { matchScore } from '@/lib/utils'
import type {
  CalendarEvent,
  DateOnly,
  Habit,
  HabitLog,
  Label,
  Note,
  Project,
  SearchHit,
  Task,
  TaskLabel,
} from '@/types'

/**
 * Pure derivations over store arrays.
 *
 * Kept out of the store on purpose: components call these inside `useMemo` on
 * the raw arrays, so nothing here can create a new reference on every render
 * and re-trigger a subscription.
 */

export function sortByPosition<T extends { position: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.position - b.position)
}

/** The order a human reads a list in: overdue first, then priority, then due date. */
export function sortForList(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aOver = isOverdue(a.due_date) ? 0 : 1
    const bOver = isOverdue(b.due_date) ? 0 : 1
    if (aOver !== bOver) return aOver - bOver
    if (a.priority !== b.priority) return a.priority - b.priority
    if (a.due_date !== b.due_date) {
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date < b.due_date ? -1 : 1
    }
    return a.position - b.position
  })
}

export const activeTasks = (tasks: Task[]) => tasks.filter((t) => t.status !== 'done')

export const inboxTasks = (tasks: Task[]) =>
  sortForList(tasks.filter((t) => t.status === 'inbox'))

/**
 * "Today" is anything you said you'd do today, anything due today, plus
 * anything overdue — an overdue task that doesn't show up today is how tasks
 * get quietly lost.
 */
export function todayTasks(tasks: Task[]): Task[] {
  const t = today()
  return sortForList(
    tasks.filter(
      (task) =>
        task.status !== 'done' &&
        (task.status === 'today' ||
          task.status === 'doing' ||
          task.due_date === t ||
          isOverdue(task.due_date)),
    ),
  )
}

export const overdueTasks = (tasks: Task[]) =>
  sortForList(tasks.filter((t) => t.status !== 'done' && isOverdue(t.due_date)))

/** Deadlines in the next `days` days, excluding today. */
export function upcomingTasks(tasks: Task[], days = 7): Task[] {
  const start = fromDateOnly(today()).getTime()
  const end = start + days * 86_400_000
  return sortForList(
    tasks.filter((t) => {
      if (t.status === 'done' || !t.due_date) return false
      const due = fromDateOnly(t.due_date).getTime()
      return due > start && due <= end
    }),
  )
}

export const tasksForProject = (tasks: Task[], projectId: string) =>
  sortForList(tasks.filter((t) => t.project_id === projectId))

export const tasksByStatus = (tasks: Task[], status: Task['status']) =>
  [...tasks.filter((t) => t.status === status)].sort((a, b) => a.position - b.position)

export function labelsForTask(
  taskId: string,
  labels: Label[],
  taskLabels: TaskLabel[],
): Label[] {
  const ids = new Set(taskLabels.filter((tl) => tl.task_id === taskId).map((tl) => tl.label_id))
  return labels.filter((l) => ids.has(l.id))
}

export function eventsOnDay(events: CalendarEvent[], day: DateOnly): CalendarEvent[] {
  return events
    .filter((e) => toDateOnly(new Date(e.start_at)) === day)
    .sort((a, b) => a.start_at.localeCompare(b.start_at))
}

export const todayEvents = (events: CalendarEvent[]) => eventsOnDay(events, today())

/** Events still to come today — the dashboard shouldn't dwell on this morning. */
export function remainingTodayEvents(events: CalendarEvent[]): CalendarEvent[] {
  const now = Date.now()
  return todayEvents(events).filter((e) => new Date(e.end_at).getTime() >= now)
}

export function habitProgress(habit: Habit, logs: HabitLog[], day: DateOnly = today()) {
  const log = logs.find((l) => l.habit_id === habit.id && l.date === day)
  const count = log?.count ?? 0
  return {
    count,
    target: habit.target_per_day,
    done: count >= habit.target_per_day,
    ratio: Math.min(1, count / Math.max(1, habit.target_per_day)),
  }
}

export function habitStreak(habit: Habit, logs: HabitLog[]): number {
  const days = new Set(
    logs.filter((l) => l.habit_id === habit.id && l.count >= habit.target_per_day).map((l) => l.date),
  )
  return currentStreak(days)
}

/** Days on which *every* active habit was completed — the dashboard streak. */
export function overallStreak(habits: Habit[], logs: HabitLog[]): number {
  const active = habits.filter((h) => !h.archived)
  if (!active.length) return 0
  const byDay = new Map<DateOnly, Set<string>>()
  for (const log of logs) {
    const habit = active.find((h) => h.id === log.habit_id)
    if (!habit || log.count < habit.target_per_day) continue
    if (!byDay.has(log.date)) byDay.set(log.date, new Set())
    byDay.get(log.date)!.add(habit.id)
  }
  const complete = new Set(
    [...byDay.entries()].filter(([, ids]) => ids.size === active.length).map(([day]) => day),
  )
  return currentStreak(complete)
}

export function projectStats(projectId: string, tasks: Task[]) {
  const mine = tasks.filter((t) => t.project_id === projectId)
  const done = mine.filter((t) => t.status === 'done').length
  return {
    total: mine.length,
    done,
    open: mine.length - done,
    ratio: mine.length ? done / mine.length : 0,
  }
}

/**
 * The project you're most plausibly "in" right now: most tasks currently in
 * Doing, falling back to the one with the nearest deadline.
 */
export function currentProject(projects: Project[], tasks: Task[]): Project | null {
  const live = projects.filter((p) => !p.archived)
  if (!live.length) return null

  const doingCount = new Map<string, number>()
  for (const t of tasks) {
    if (t.status !== 'doing' || !t.project_id) continue
    doingCount.set(t.project_id, (doingCount.get(t.project_id) ?? 0) + 1)
  }
  if (doingCount.size) {
    const [id] = [...doingCount.entries()].sort((a, b) => b[1] - a[1])[0]
    return live.find((p) => p.id === id) ?? null
  }

  const withDeadlines = tasks
    .filter((t) => t.status !== 'done' && t.due_date && t.project_id)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
  const next = withDeadlines[0]
  return next ? (live.find((p) => p.id === next.project_id) ?? null) : null
}

export interface SearchSources {
  tasks: Task[]
  notes: Note[]
  projects: Project[]
  events: CalendarEvent[]
}

/** Global search. Ranked, capped, and cheap enough to run on every keystroke. */
export function search(query: string, sources: SearchSources, limit = 20): SearchHit[] {
  const q = query.trim()
  if (!q) return []

  const scored: { score: number; hit: SearchHit }[] = []

  for (const task of sources.tasks) {
    const score = Math.max(
      matchScore(task.title, q),
      task.description ? matchScore(task.description, q) - 10 : -1,
    )
    if (score < 0) continue
    const project = sources.projects.find((p) => p.id === task.project_id)
    scored.push({
      score: score + (task.status === 'done' ? -15 : 0),
      hit: {
        kind: 'task',
        id: task.id,
        title: task.title,
        subtitle: project?.name ?? 'No project',
        task,
      },
    })
  }

  for (const note of sources.notes) {
    const score = Math.max(matchScore(note.title, q), matchScore(note.content, q) - 10)
    if (score < 0) continue
    scored.push({
      score,
      hit: { kind: 'note', id: note.id, title: note.title, subtitle: 'Note', note },
    })
  }

  for (const project of sources.projects) {
    const score = matchScore(project.name, q)
    if (score < 0) continue
    scored.push({
      score,
      hit: {
        kind: 'project',
        id: project.id,
        title: project.name,
        subtitle: 'Project',
        project,
      },
    })
  }

  for (const event of sources.events) {
    const score = matchScore(event.title, q)
    if (score < 0) continue
    scored.push({
      score,
      hit: {
        kind: 'event',
        id: event.id,
        title: event.title,
        subtitle: new Date(event.start_at).toLocaleDateString(),
        event,
      },
    })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.hit)
}

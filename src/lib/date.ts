import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameYear,
  parseISO,
  startOfDay,
  subDays,
} from 'date-fns'
import type { DateOnly, Timestamp } from '@/types'

/**
 * All "day" values in Atlas are local calendar days, never UTC. Using
 * `toISOString().slice(0,10)` here would silently shift the date for anyone
 * west of Greenwich after 00:00 UTC, which is exactly when a to-do app is
 * least forgivable.
 */
export function toDateOnly(d: Date = new Date()): DateOnly {
  return format(d, 'yyyy-MM-dd')
}

export function fromDateOnly(s: DateOnly): Date {
  // Parsing as local midnight (not `new Date(s)`, which parses as UTC).
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const today = () => toDateOnly()
export const tomorrow = () => toDateOnly(addDays(new Date(), 1))

export function isOverdue(due: DateOnly | null): boolean {
  if (!due) return false
  return differenceInCalendarDays(fromDateOnly(due), startOfDay(new Date())) < 0
}

export function isDueToday(due: DateOnly | null): boolean {
  return !!due && due === today()
}

/** Human due-date label: Today, Tomorrow, Yesterday, Fri, 12 Aug, 12 Aug 2027. */
export function formatDue(due: DateOnly | null): string {
  if (!due) return ''
  const d = fromDateOnly(due)
  const diff = differenceInCalendarDays(d, startOfDay(new Date()))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return format(d, 'EEE')
  if (diff < -1 && diff > -7) return `${format(d, 'EEE')} (late)`
  if (isSameYear(d, new Date())) return format(d, 'd MMM')
  return format(d, 'd MMM yyyy')
}

export function formatTimeRange(start: Timestamp, end: Timestamp, allDay: boolean) {
  const s = parseISO(start)
  const e = parseISO(end)
  if (allDay) {
    return isSameDay(s, e) ? format(s, 'd MMM') : `${format(s, 'd MMM')} – ${format(e, 'd MMM')}`
  }
  if (isSameDay(s, e)) return `${format(s, 'HH:mm')} – ${format(e, 'HH:mm')}`
  return `${format(s, 'd MMM HH:mm')} – ${format(e, 'd MMM HH:mm')}`
}

export function formatClock(ts: Timestamp) {
  return format(parseISO(ts), 'HH:mm')
}

export function formatLongDate(d: Date = new Date()) {
  return format(d, 'EEEE, d MMMM')
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours()
  if (h < 5) return 'Still up'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function formatRelative(ts: Timestamp): string {
  const d = parseISO(ts)
  const mins = Math.round((Date.now() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days}d ago`
  return format(d, 'd MMM')
}

/** The last `n` calendar days ending today, oldest first. */
export function lastNDays(n: number): DateOnly[] {
  const out: DateOnly[] = []
  for (let i = n - 1; i >= 0; i--) out.push(toDateOnly(subDays(new Date(), i)))
  return out
}

/**
 * Consecutive completed days ending today (or yesterday — a streak shouldn't
 * die just because it's 9am and you haven't done it yet).
 */
export function currentStreak(completedDays: Set<DateOnly>): number {
  let streak = 0
  let cursor = new Date()
  if (!completedDays.has(toDateOnly(cursor))) {
    cursor = subDays(cursor, 1)
    if (!completedDays.has(toDateOnly(cursor))) return 0
  }
  while (completedDays.has(toDateOnly(cursor))) {
    streak++
    cursor = subDays(cursor, 1)
  }
  return streak
}

export function longestStreak(completedDays: Set<DateOnly>): number {
  const sorted = [...completedDays].sort()
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const day of sorted) {
    const d = fromDateOnly(day)
    run = prev && differenceInCalendarDays(d, prev) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Round a Date to the nearest N minutes — used when dropping tasks on the grid. */
export function roundToNearest(d: Date, minutes: number): Date {
  const ms = minutes * 60_000
  return new Date(Math.round(d.getTime() / ms) * ms)
}

export function addMinutes(ts: Timestamp, minutes: number): Timestamp {
  return new Date(parseISO(ts).getTime() + minutes * 60_000).toISOString()
}

export { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay }

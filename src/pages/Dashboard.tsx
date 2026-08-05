import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Check, Flame, Sun } from 'lucide-react'
import {
  formatClock,
  formatLongDate,
  greeting,
  isOverdue,
  today,
} from '@/lib/date'
import { cn, pluralize } from '@/lib/utils'
import { useData } from '@/store/data'
import {
  currentProject,
  habitProgress,
  overallStreak,
  projectStats,
  remainingTodayEvents,
  todayTasks,
  upcomingTasks,
} from '@/store/selectors'
import { useUI } from '@/store/ui'
import { Page } from '@/components/layout/AppShell'
import { TaskList } from '@/components/task/TaskItem'
import { Button } from '@/components/ui/button'
import { EmptyState, Icon, Ring, SectionTitle } from '@/components/ui/misc'

export function Dashboard() {
  const tasks = useData((s) => s.tasks)
  const events = useData((s) => s.events)
  const projects = useData((s) => s.projects)
  const habits = useData((s) => s.habits)
  const habitLogs = useData((s) => s.habit_logs)
  const logHabit = useData((s) => s.logHabit)
  const user = useData((s) => s.user)
  const setQuickAddOpen = useUI((s) => s.setQuickAddOpen)

  const todays = useMemo(() => todayTasks(tasks), [tasks])
  const upcoming = useMemo(() => upcomingTasks(tasks, 7), [tasks])
  const nextEvents = useMemo(() => remainingTodayEvents(events), [events])
  const focus = useMemo(() => currentProject(projects, tasks), [projects, tasks])
  const streak = useMemo(() => overallStreak(habits, habitLogs), [habits, habitLogs])
  const liveHabits = useMemo(() => habits.filter((h) => !h.archived), [habits])

  const overdueCount = todays.filter((t) => isOverdue(t.due_date)).length
  const doneToday = tasks.filter(
    (t) => t.status === 'done' && t.completed_at?.slice(0, 10) === today(),
  ).length

  const firstName = (user?.display_name ?? '').split(' ')[0]

  return (
    <Page
      title={
        <span>
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </span>
      }
      subtitle={formatLongDate()}
      actions={
        streak > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 text-[12px] font-medium">
            <Flame className="size-3.5 text-warn" />
            {streak} day{streak === 1 ? '' : 's'}
          </span>
        ) : null
      }
    >
      <div className="space-y-7">
        {/* The one-line answer to "what should I do right now?" */}
        <div className="card flex items-center gap-4 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] bg-accent-soft">
            <Sun className="size-5 text-accent" />
          </span>
          <div className="min-w-0 flex-1">
            {todays.length === 0 ? (
              <>
                <p className="text-[14px] font-medium">Nothing scheduled for today</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {doneToday > 0
                    ? `You finished ${pluralize(doneToday, 'task')} today.`
                    : 'Capture something, or take the afternoon off.'}
                </p>
              </>
            ) : (
              <>
                <p className="truncate text-[14px] font-medium">{todays[0].title}</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {pluralize(todays.length, 'task')} today
                  {overdueCount > 0 && (
                    <span className="text-danger"> · {overdueCount} overdue</span>
                  )}
                  {doneToday > 0 && <span> · {doneToday} done</span>}
                </p>
              </>
            )}
          </div>
          <Button size="sm" variant="secondary" onClick={() => setQuickAddOpen(true)}>
            Capture
          </Button>
        </div>

        {/* Today */}
        <section>
          <SectionTitle
            count={todays.length}
            action={
              <Link
                to="/board"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-fg"
              >
                Board <ArrowRight className="size-3" />
              </Link>
            }
          >
            Today
          </SectionTitle>
          {todays.length ? (
            <TaskList tasks={todays.slice(0, 8)} />
          ) : (
            <div className="card">
              <EmptyState
                icon="Check"
                title="Clear"
                description="Anything you mark for today shows up here, along with anything overdue."
              />
            </div>
          )}
          {todays.length > 8 && (
            <Link
              to="/board"
              className="mt-2 inline-block text-[12px] text-muted transition-colors hover:text-fg"
            >
              {todays.length - 8} more →
            </Link>
          )}
        </section>

        <div className="grid gap-7 md:grid-cols-2">
          {/* Schedule */}
          <section>
            <SectionTitle
              action={
                <Link
                  to="/calendar"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-fg"
                >
                  Calendar <ArrowRight className="size-3" />
                </Link>
              }
            >
              Rest of today
            </SectionTitle>
            {nextEvents.length ? (
              <div className="card divide-hairline overflow-hidden">
                {nextEvents.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span
                      className="h-8 w-0.5 shrink-0 rounded-full"
                      style={{ background: e.color ?? 'var(--color-accent)' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{e.title}</p>
                      <p className="text-[11px] tabular-nums text-muted">
                        {e.all_day
                          ? 'All day'
                          : `${formatClock(e.start_at)} – ${formatClock(e.end_at)}`}
                        {e.location && ` · ${e.location}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card px-3 py-6 text-center">
                <CalendarClock className="mx-auto mb-2 size-4 text-faint" />
                <p className="text-[13px] text-muted">Nothing left on the calendar today</p>
              </div>
            )}
          </section>

          {/* Upcoming deadlines */}
          <section>
            <SectionTitle count={upcoming.length}>Next seven days</SectionTitle>
            {upcoming.length ? (
              <TaskList tasks={upcoming.slice(0, 5)} compact />
            ) : (
              <div className="card px-3 py-6 text-center">
                <Check className="mx-auto mb-2 size-4 text-faint" />
                <p className="text-[13px] text-muted">No deadlines this week</p>
              </div>
            )}
          </section>
        </div>

        {/* Habits */}
        {liveHabits.length > 0 && (
          <section>
            <SectionTitle
              action={
                <Link
                  to="/habits"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-fg"
                >
                  All habits <ArrowRight className="size-3" />
                </Link>
              }
            >
              Today's habits
            </SectionTitle>
            <div className="card flex flex-wrap gap-2 p-3">
              {liveHabits.map((h) => {
                const p = habitProgress(h, habitLogs)
                return (
                  <button
                    key={h.id}
                    onClick={() => void logHabit(h.id, today(), p.done ? -p.count : 1)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-[var(--radius-md)] border px-2.5 py-2 transition-all active:scale-[0.97]',
                      p.done
                        ? 'border-transparent'
                        : 'border-border hover:border-border-strong',
                    )}
                    style={p.done ? { background: `color-mix(in oklab, ${h.color} 14%, transparent)` } : undefined}
                    aria-label={`${h.name}: ${p.count} of ${p.target}`}
                  >
                    <Ring ratio={p.ratio} size={26} stroke={2.5} color={h.color}>
                      <Icon
                        name={h.icon}
                        className="size-3"
                        style={{ color: p.done ? h.color : 'var(--color-faint)' }}
                      />
                    </Ring>
                    <span className="text-[12px] font-medium">{h.name}</span>
                    {h.target_per_day > 1 && (
                      <span className="text-[11px] tabular-nums text-faint">
                        {p.count}/{p.target}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Current project */}
        {focus && (
          <section>
            <SectionTitle>Current project</SectionTitle>
            <Link
              to={`/projects/${focus.id}`}
              className="card flex items-center gap-3 p-4 transition-colors hover:border-border-strong"
            >
              <span
                className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)]"
                style={{ background: `color-mix(in oklab, ${focus.color} 16%, transparent)` }}
              >
                <Icon name={focus.icon} className="size-4" style={{ color: focus.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{focus.name}</p>
                <p className="text-[12px] text-muted">
                  {(() => {
                    const s = projectStats(focus.id, tasks)
                    return `${s.open} open · ${s.done} done`
                  })()}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-faint" />
            </Link>
          </section>
        )}
      </div>
    </Page>
  )
}

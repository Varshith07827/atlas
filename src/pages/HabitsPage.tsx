import { useMemo, useState } from 'react'
import { Check, Flame, Minus, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { format, fromDateOnly, lastNDays, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { habitProgress, habitStreak, overallStreak, sortByPosition } from '@/store/selectors'
import type { Habit } from '@/types'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import {
  ConfirmDialog,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlay'
import { EmptyState, Icon, Ring, SectionTitle } from '@/components/ui/misc'

const HABIT_ICONS = [
  'BookOpen',
  'Dumbbell',
  'Book',
  'Sparkles',
  'Droplet',
  'Moon',
  'Footprints',
  'Brain',
  'Music',
  'Languages',
  'Pill',
  'Sun',
]

const HABIT_COLORS = [
  'oklch(65% 0.16 258)',
  'oklch(70% 0.17 40)',
  'oklch(68% 0.14 300)',
  'oklch(70% 0.12 200)',
  'oklch(68% 0.15 150)',
  'oklch(72% 0.15 90)',
]

/** Fourteen-day trail. Enough to see a pattern, few enough to fit on a phone. */
function Trail({ habit }: { habit: Habit }) {
  const logs = useData((s) => s.habit_logs)
  const days = useMemo(() => lastNDays(14), [])

  return (
    <div className="flex gap-[3px]">
      {days.map((day) => {
        const p = habitProgress(habit, logs, day)
        return (
          <span
            key={day}
            title={`${format(fromDateOnly(day), 'd MMM')} — ${p.count}/${p.target}`}
            className="h-5 w-[7px] rounded-full transition-colors"
            style={{
              background: p.done
                ? habit.color
                : p.count > 0
                  ? `color-mix(in oklab, ${habit.color} 40%, var(--color-border))`
                  : 'var(--color-border)',
            }}
          />
        )
      })}
    </div>
  )
}

function HabitRow({ habit }: { habit: Habit }) {
  const logs = useData((s) => s.habit_logs)
  const logHabit = useData((s) => s.logHabit)
  const updateHabit = useData((s) => s.updateHabit)
  const deleteHabit = useData((s) => s.deleteHabit)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const p = habitProgress(habit, logs)
  const streak = habitStreak(habit, logs)
  const stepped = habit.target_per_day > 1

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-3">
        <button
          onClick={() => void logHabit(habit.id, today(), p.done && !stepped ? -p.count : 1)}
          className="shrink-0 transition-transform active:scale-90"
          aria-label={`${habit.name}: ${p.count} of ${p.target}`}
        >
          <Ring ratio={p.ratio} size={38} stroke={3} color={habit.color}>
            {p.done ? (
              <Check className="size-4" style={{ color: habit.color }} strokeWidth={3} />
            ) : (
              <Icon name={habit.icon} className="size-4 text-faint" />
            )}
          </Ring>
        </button>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[14px] font-medium">
            <span className="truncate">{habit.name}</span>
            {streak > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-warn">
                <Flame className="size-3" />
                {streak}
              </span>
            )}
          </p>
          <p className="mt-1 flex items-center gap-2">
            <Trail habit={habit} />
            {stepped && (
              <span className="text-[11px] tabular-nums text-muted">
                {p.count}/{p.target}
                {habit.unit ? ` ${habit.unit}` : ''}
              </span>
            )}
          </p>
        </div>

        {stepped && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => void logHabit(habit.id, today(), -1)}
              disabled={p.count === 0}
              className="grid size-7 place-items-center rounded-[var(--radius-sm)] border border-border text-muted transition-colors hover:text-fg disabled:opacity-30"
              aria-label={`One less ${habit.name}`}
            >
              <Minus className="size-3.5" />
            </button>
            <button
              onClick={() => void logHabit(habit.id, today(), 1)}
              className="grid size-7 place-items-center rounded-[var(--radius-sm)] border border-border text-muted transition-colors hover:text-fg"
              aria-label={`One more ${habit.name}`}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-sm)] text-faint transition-colors hover:bg-elevated hover:text-fg"
              aria-label={`${habit.name} options`}
            >
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void updateHabit(habit.id, { archived: true })}>
              <Icon name="Archive" className="size-4" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${habit.name}"?`}
        description="Its whole history goes with it."
        onConfirm={() => void deleteHabit(habit.id)}
      />
    </>
  )
}

export function HabitsPage() {
  const habits = useData((s) => s.habits)
  const logs = useData((s) => s.habit_logs)
  const createHabit = useData((s) => s.createHabit)
  const updateHabit = useData((s) => s.updateHabit)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState({
    name: '',
    icon: HABIT_ICONS[0],
    color: HABIT_COLORS[0],
    target: 1,
    unit: '',
  })

  const live = useMemo(() => sortByPosition(habits.filter((h) => !h.archived)), [habits])
  const archived = useMemo(() => habits.filter((h) => h.archived), [habits])
  const streak = useMemo(() => overallStreak(habits, logs), [habits, logs])
  const doneToday = live.filter((h) => habitProgress(h, logs).done).length

  return (
    <Page
      title="Habits"
      subtitle={
        live.length
          ? `${doneToday} of ${live.length} done today`
          : 'Small things, done often.'
      }
      actions={
        <>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-elevated px-2.5 py-1 text-[12px] font-medium">
              <Flame className="size-3.5 text-warn" />
              {streak}
            </span>
          )}
          <Button size="sm" variant="accent" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            New
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {live.length ? (
          <div className="card divide-hairline overflow-hidden">
            {live.map((h) => (
              <HabitRow key={h.id} habit={h} />
            ))}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon="Repeat"
              title="No habits yet"
              description="Pick two or three you actually want to keep. More than that and none of them stick."
              action={
                <Button size="sm" variant="accent" onClick={() => setOpen(true)}>
                  <Plus className="size-3.5" />
                  Add a habit
                </Button>
              }
            />
          </div>
        )}

        {archived.length > 0 && (
          <section>
            <SectionTitle count={archived.length}>Archived</SectionTitle>
            <div className="card divide-hairline overflow-hidden">
              {archived.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon name={h.icon} className="size-4 shrink-0 text-faint" />
                  <span className="flex-1 truncate text-[13px] text-muted">{h.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void updateHabit(h.id, { archived: false })}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">New habit</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Field label="Name">
              <Input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Read for 20 minutes"
              />
            </Field>

            <Field label="Icon">
              <div className="flex flex-wrap gap-1.5">
                {HABIT_ICONS.map((name) => (
                  <button
                    key={name}
                    onClick={() => setDraft({ ...draft, icon: name })}
                    className={cn(
                      'grid size-8 place-items-center rounded-[var(--radius-sm)] border transition-colors',
                      draft.icon === name
                        ? 'border-accent bg-accent-soft'
                        : 'border-border hover:border-border-strong',
                    )}
                    aria-label={name}
                  >
                    <Icon name={name} className="size-4" style={{ color: draft.color }} />
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Colour">
              <div className="flex gap-1.5">
                {HABIT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDraft({ ...draft, color: c })}
                    className={cn(
                      'size-7 rounded-full transition-transform hover:scale-110',
                      draft.color === c && 'ring-2 ring-fg ring-offset-2 ring-offset-surface',
                    )}
                    style={{ background: c }}
                    aria-label={`Colour ${c}`}
                  />
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Times per day">
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={draft.target}
                  onChange={(e) =>
                    setDraft({ ...draft, target: Math.max(1, Number(e.target.value) || 1) })
                  }
                />
              </Field>
              <Field label="Unit" hint="Optional — glasses, pages, km">
                <Input
                  value={draft.unit}
                  onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                  placeholder="—"
                />
              </Field>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!draft.name.trim()}
              onClick={() => {
                void createHabit({
                  name: draft.name.trim(),
                  icon: draft.icon,
                  color: draft.color,
                  target_per_day: draft.target,
                  unit: draft.unit.trim() || null,
                })
                setDraft({ name: '', icon: HABIT_ICONS[0], color: HABIT_COLORS[0], target: 1, unit: '' })
                setOpen(false)
              }}
            >
              Add habit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

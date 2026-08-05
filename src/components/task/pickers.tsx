import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flag,
  Folder,
  Tag,
  Timer,
  X,
} from 'lucide-react'
import {
  addDays,
  format,
  formatDue,
  formatDuration,
  fromDateOnly,
  isOverdue,
  toDateOnly,
} from '@/lib/date'
import { onEnter } from '@/lib/keys'
import { cn } from '@/lib/utils'
import { PRIORITY_COLOR, PRIORITY_LABEL, type DateOnly, type Label, type Priority, type Project } from '@/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/menu'
import { Icon } from '@/components/ui/misc'

/* -------------------------------------------------------------------------- */

export function PriorityMenu({
  value,
  onChange,
  children,
}: {
  value: Priority
  onChange: (p: Priority) => void
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Priority</DropdownMenuLabel>
        {([1, 2, 3, 4] as Priority[]).map((p) => (
          <DropdownMenuItem key={p} onSelect={() => onChange(p)}>
            <Flag className="size-4" style={{ color: PRIORITY_COLOR[p] }} />
            <span>{PRIORITY_LABEL[p]}</span>
            {value === p && <Check className="ml-auto size-3.5 text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------------------- */

export function ProjectMenu({
  value,
  projects,
  onChange,
  children,
}: {
  value: string | null
  projects: Project[]
  onChange: (id: string | null) => void
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        <DropdownMenuLabel>Project</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <Folder className="size-4" />
          <span className="text-muted">No project</span>
          {value === null && <Check className="ml-auto size-3.5 text-accent" />}
        </DropdownMenuItem>
        {projects.filter((p) => !p.archived).length > 0 && <DropdownMenuSeparator />}
        {projects
          .filter((p) => !p.archived)
          .map((p) => (
            <DropdownMenuItem key={p.id} onSelect={() => onChange(p.id)}>
              <Icon name={p.icon} className="size-4" style={{ color: p.color }} />
              <span className="truncate">{p.name}</span>
              {value === p.id && <Check className="ml-auto size-3.5 shrink-0 text-accent" />}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------------------- */

export function LabelMenu({
  selected,
  labels,
  onChange,
  onCreate,
  children,
}: {
  selected: string[]
  labels: Label[]
  onChange: (ids: string[]) => void
  onCreate?: (name: string) => void
  children: React.ReactNode
}) {
  const [draft, setDraft] = useState('')

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const createFromDraft = () => {
    const name = draft.trim()
    if (!name || !onCreate) return
    onCreate(name)
    setDraft('')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-1.5">
        <div className="max-h-56 overflow-y-auto">
          {labels.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-faint">No labels yet</p>
          )}
          {labels.map((l) => (
            <button
              key={l.id}
              onClick={() => toggle(l.id)}
              className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] hover:bg-surface"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ background: l.color }} />
              <span className="truncate">{l.name}</span>
              {selected.includes(l.id) && <Check className="ml-auto size-3.5 shrink-0 text-accent" />}
            </button>
          ))}
        </div>
        {onCreate && (
          <form
            className="mt-1 border-t border-border pt-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              createFromDraft()
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onEnter(createFromDraft)}
              placeholder="New label…"
              className="w-full rounded-[var(--radius-sm)] bg-transparent px-2 py-1.5 text-[13px] placeholder:text-faint focus:outline-none"
            />
          </form>
        )}
      </PopoverContent>
    </Popover>
  )
}

/* -------------------------------------------------------------------------- */

export function EstimateMenu({
  value,
  onChange,
  children,
}: {
  value: number | null
  onChange: (minutes: number | null) => void
  children: React.ReactNode
}) {
  const options = [5, 10, 15, 25, 30, 45, 60, 90, 120, 180]
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
        <DropdownMenuLabel>Estimate</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onChange(null)}>
          <Timer className="size-4" />
          <span className="text-muted">No estimate</span>
          {value === null && <Check className="ml-auto size-3.5 text-accent" />}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {options.map((m) => (
          <DropdownMenuItem key={m} onSelect={() => onChange(m)}>
            <Timer className="size-4" />
            <span>{formatDuration(m)}</span>
            {value === m && <Check className="ml-auto size-3.5 text-accent" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * Date picker.
 *
 * Hand-rolled rather than pulled from a library: the quick options at the top
 * are what actually get used ninety per cent of the time, and a full month grid
 * from a dependency would have been styled to match anyway.
 */
export function DueDatePicker({
  value,
  onChange,
  children,
}: {
  value: DateOnly | null
  onChange: (d: DateOnly | null) => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => (value ? fromDateOnly(value) : new Date()))

  const pick = (d: DateOnly | null) => {
    onChange(d)
    setOpen(false)
  }

  const grid = useMemo(() => buildMonth(cursor), [cursor])
  const now = toDateOnly()

  const quick: { label: string; date: DateOnly | null; hint: string }[] = [
    { label: 'Today', date: toDateOnly(), hint: format(new Date(), 'EEE') },
    {
      label: 'Tomorrow',
      date: toDateOnly(addDays(new Date(), 1)),
      hint: format(addDays(new Date(), 1), 'EEE'),
    },
    {
      label: 'Next week',
      date: toDateOnly(addDays(new Date(), 7)),
      hint: format(addDays(new Date(), 7), 'd MMM'),
    },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[17.5rem] p-2">
        <div className="space-y-0.5">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => pick(q.date)}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] hover:bg-surface"
            >
              <CalendarDays className="size-3.5 text-faint" />
              {q.label}
              <span className="ml-auto text-[11px] text-faint">{q.hint}</span>
            </button>
          ))}
          {value && (
            <button
              onClick={() => pick(null)}
              className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[13px] text-danger hover:bg-surface"
            >
              <X className="size-3.5" />
              Clear date
            </button>
          )}
        </div>

        <div className="mt-2 border-t border-border pt-2">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-faint hover:bg-surface hover:text-fg"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-[13px] font-medium">{format(cursor, 'MMMM yyyy')}</span>
            <button
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="grid size-6 place-items-center rounded-[var(--radius-sm)] text-faint hover:bg-surface hover:text-fg"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px text-center">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i} className="pb-1 text-[10px] font-medium text-faint">
                {d}
              </span>
            ))}
            {grid.map((day) => {
              const iso = toDateOnly(day)
              const outside = day.getMonth() !== cursor.getMonth()
              const selected = value === iso
              return (
                <button
                  key={iso}
                  onClick={() => pick(iso)}
                  className={cn(
                    'grid h-7 place-items-center rounded-[var(--radius-sm)] text-[12px] tabular-nums transition-colors',
                    outside && 'text-faint/50',
                    !outside && 'text-fg hover:bg-surface',
                    iso === now && !selected && 'font-bold text-accent',
                    selected && 'bg-accent font-semibold text-accent-fg hover:bg-accent',
                  )}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Six weeks starting Monday, so the grid never reflows between months. */
function buildMonth(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const start = addDays(first, -offset)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** Shared chip used by the task row and detail sheet. */
export function DueChip({ due, className }: { due: DateOnly | null; className?: string }) {
  if (!due) return null
  const late = isOverdue(due)
  const soon = due === toDateOnly()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-[11px] font-medium tabular-nums',
        late ? 'text-danger' : soon ? 'text-warn' : 'text-muted',
        className,
      )}
    >
      <CalendarDays className="size-3" />
      {formatDue(due)}
    </span>
  )
}

export function LabelChips({ labels }: { labels: Label[] }) {
  if (!labels.length) return null
  return (
    <span className="inline-flex items-center gap-1">
      {labels.map((l) => (
        <span
          key={l.id}
          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none"
          style={{
            color: l.color,
            background: `color-mix(in oklab, ${l.color} 14%, transparent)`,
          }}
        >
          <Tag className="size-2.5" />
          {l.name}
        </span>
      ))}
    </span>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, CornerDownLeft, Flag, Inbox, Sun } from 'lucide-react'
import { toast } from 'sonner'
import { formatDue } from '@/lib/date'
import { onEnter } from '@/lib/keys'
import { cn, fuzzyMatch } from '@/lib/utils'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import { PRIORITY_COLOR, PRIORITY_LABEL, type DateOnly, type Priority } from '@/types'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlay'
import { Icon, Kbd } from '@/components/ui/misc'
import { DueDatePicker, PriorityMenu, ProjectMenu } from './task/pickers'

interface Parsed {
  title: string
  priority: Priority | null
  projectName: string | null
  labelNames: string[]
}

/**
 * Light shorthand, parsed only from explicit tokens:
 *
 *   `!1`–`!4`   priority        `#college`  project       `@deep-work`  label
 *
 * Deliberately no natural-language dates: silently eating the word "today" out
 * of a task called "today's standup notes" is the kind of cleverness that makes
 * people distrust a capture box.
 */
function parse(input: string): Parsed {
  let title = input
  let priority: Priority | null = null
  let projectName: string | null = null
  const labelNames: string[] = []

  title = title.replace(/(?:^|\s)!([1-4])\b/g, (_, digit: string) => {
    priority = Number(digit) as Priority
    return ' '
  })
  title = title.replace(/(?:^|\s)#([\w-]+)/g, (_, name: string) => {
    projectName = name.replace(/-/g, ' ')
    return ' '
  })
  title = title.replace(/(?:^|\s)@([\w-]+)/g, (_, name: string) => {
    labelNames.push(name.replace(/-/g, ' '))
    return ' '
  })

  return { title: title.replace(/\s+/g, ' ').trim(), priority, projectName, labelNames }
}

export function QuickAdd() {
  const open = useUI((s) => s.quickAddOpen)
  const setOpen = useUI((s) => s.setQuickAddOpen)

  const projects = useData((s) => s.projects)
  const labels = useData((s) => s.labels)
  const createTask = useData((s) => s.createTask)
  const createLabel = useData((s) => s.createLabel)
  const setTaskLabels = useData((s) => s.setTaskLabels)

  const [value, setValue] = useState('')
  const [priority, setPriority] = useState<Priority>(4)
  const [due, setDue] = useState<DateOnly | null>(null)
  const [projectId, setProjectId] = useState<string | null>(null)
  const [forToday, setForToday] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setValue('')
    setPriority(4)
    setDue(null)
    setProjectId(null)
    setForToday(false)
    // Radix moves focus on open; wait a frame so we don't fight it.
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const parsed = useMemo(() => parse(value), [value])
  const project = projects.find((p) => p.id === projectId)

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const { title, priority: shorthandPriority, projectName, labelNames } = parsed
    if (!title) return

    const matchedProject = projectName
      ? projects.find((p) => fuzzyMatch(p.name, projectName))
      : null

    const task = await createTask({
      title,
      priority: shorthandPriority ?? priority,
      due_date: due,
      project_id: matchedProject?.id ?? projectId,
      status: forToday ? 'today' : 'inbox',
    })

    if (task && labelNames.length) {
      const ids: string[] = []
      for (const name of labelNames) {
        const existing = labels.find((l) => fuzzyMatch(l.name, name))
        if (existing) ids.push(existing.id)
        else {
          const created = await createLabel(name, 'oklch(68% 0.14 260)')
          if (created) ids.push(created.id)
        }
      }
      if (ids.length) await setTaskLabels(task.id, ids)
    }

    toast.success(forToday ? 'Added to Today' : 'Captured to Inbox', {
      description: title,
      duration: 1800,
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[22%] max-w-xl translate-y-0 p-0" hideClose>
        <DialogTitle className="sr-only">Quick add</DialogTitle>
        <form onSubmit={submit}>
          <div className="flex items-center gap-3 px-4 pt-4">
            <Inbox className="size-4 shrink-0 text-faint" />
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onEnter(() => void submit())}
              placeholder="What's on your mind?"
              className="flex-1 bg-transparent text-[15px] placeholder:text-faint focus:outline-none"
              aria-label="Task title"
            />
          </div>

          <p className="px-4 pb-3 pt-1.5 pl-11 text-[11px] text-faint">
            <span className="font-mono">!1–!4</span> priority ·{' '}
            <span className="font-mono">#project</span> ·{' '}
            <span className="font-mono">@label</span>
          </p>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-border px-3 py-2.5">
            <button
              type="button"
              onClick={() => setForToday((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-1 text-[12px] transition-colors',
                forToday
                  ? 'border-accent/40 bg-accent-soft text-accent'
                  : 'border-border text-muted hover:text-fg',
              )}
            >
              <Sun className="size-3.5" />
              Today
            </button>

            <PriorityMenu value={parsed.priority ?? priority} onChange={setPriority}>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-2 py-1 text-[12px] text-muted transition-colors hover:text-fg"
              >
                <Flag
                  className="size-3.5"
                  style={{ color: PRIORITY_COLOR[parsed.priority ?? priority] }}
                />
                {PRIORITY_LABEL[parsed.priority ?? priority]}
              </button>
            </PriorityMenu>

            <DueDatePicker value={due} onChange={setDue}>
              <button
                type="button"
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-2 py-1 text-[12px] transition-colors hover:text-fg',
                  due ? 'text-fg' : 'text-muted',
                )}
              >
                <CalendarDays className="size-3.5" />
                {due ? formatDue(due) : 'Due'}
              </button>
            </DueDatePicker>

            <ProjectMenu value={projectId} projects={projects} onChange={setProjectId}>
              <button
                type="button"
                className="inline-flex max-w-40 items-center gap-1.5 rounded-[var(--radius-sm)] border border-border px-2 py-1 text-[12px] text-muted transition-colors hover:text-fg"
              >
                <Icon
                  name={project?.icon ?? 'Folder'}
                  className="size-3.5"
                  style={{ color: project?.color }}
                />
                <span className="truncate">{project?.name ?? 'Project'}</span>
              </button>
            </ProjectMenu>

            <button
              type="submit"
              disabled={!parsed.title}
              className="ml-auto inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-fg transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
            >
              Add
              <CornerDownLeft className="size-3" />
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Persistent one-line capture bar used at the top of Inbox. */
export function InlineCapture({
  status = 'inbox',
  projectId = null,
  placeholder = 'Capture a task…',
}: {
  status?: 'inbox' | 'today'
  projectId?: string | null
  placeholder?: string
}) {
  const createTask = useData((s) => s.createTask)
  const [value, setValue] = useState('')

  const add = () => {
    const { title, priority } = parse(value)
    if (!title) return
    void createTask({ title, status, project_id: projectId, priority: priority ?? 4 })
    setValue('')
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        add()
      }}
      className="card flex items-center gap-3 px-3 py-2.5 transition-colors focus-within:border-border-strong"
    >
      <Icon name="Plus" className="size-4 shrink-0 text-faint" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onEnter(add)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[14px] placeholder:text-faint focus:outline-none"
        aria-label={placeholder}
      />
      {value && (
        <Kbd>
          <CornerDownLeft className="size-2.5" />
        </Kbd>
      )}
    </form>
  )
}

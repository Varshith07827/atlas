import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Folder,
  Inbox,
  LayoutDashboard,
  Moon,
  Plus,
  Repeat,
  Search,
  Settings,
  Squircle,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { search } from '@/store/selectors'
import { useUI } from '@/store/ui'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/overlay'
import { Kbd } from '@/components/ui/misc'

interface Command {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
  group: string
}

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen)
  const setOpen = useUI((s) => s.setPaletteOpen)
  const setQuickAddOpen = useUI((s) => s.setQuickAddOpen)
  const openTask = useUI((s) => s.openTask)
  const theme = useUI((s) => s.theme)
  const setTheme = useUI((s) => s.setTheme)

  const tasks = useData((s) => s.tasks)
  const notes = useData((s) => s.notes)
  const projects = useData((s) => s.projects)
  const events = useData((s) => s.events)

  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const go = (to: string) => () => {
    navigate(to)
    setOpen(false)
  }

  const commands = useMemo<Command[]>(
    () => [
      {
        id: 'capture',
        label: 'Capture a task',
        hint: 'C',
        icon: <Plus className="size-4" />,
        group: 'Actions',
        run: () => {
          setOpen(false)
          // Let the palette finish closing before the next dialog claims focus.
          setTimeout(() => setQuickAddOpen(true), 60)
        },
      },
      {
        id: 'theme',
        label: theme === 'dark' ? 'Switch to light' : 'Switch to dark',
        icon: theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />,
        group: 'Actions',
        run: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark')
          setOpen(false)
        },
      },
      { id: 'nav-dash', label: 'Dashboard', hint: 'G D', icon: <LayoutDashboard className="size-4" />, group: 'Go to', run: go('/') },
      { id: 'nav-inbox', label: 'Inbox', hint: 'G I', icon: <Inbox className="size-4" />, group: 'Go to', run: go('/inbox') },
      { id: 'nav-board', label: 'Board', hint: 'G B', icon: <Squircle className="size-4" />, group: 'Go to', run: go('/board') },
      { id: 'nav-cal', label: 'Calendar', hint: 'G C', icon: <CalendarDays className="size-4" />, group: 'Go to', run: go('/calendar') },
      { id: 'nav-proj', label: 'Projects', hint: 'G P', icon: <Folder className="size-4" />, group: 'Go to', run: go('/projects') },
      { id: 'nav-notes', label: 'Notes', hint: 'G N', icon: <FileText className="size-4" />, group: 'Go to', run: go('/notes') },
      { id: 'nav-habits', label: 'Habits', hint: 'G H', icon: <Repeat className="size-4" />, group: 'Go to', run: go('/habits') },
      { id: 'nav-set', label: 'Settings', hint: 'G S', icon: <Settings className="size-4" />, group: 'Go to', run: go('/settings') },
    ],
    // `go` and the setters are stable enough for a list rebuilt on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, navigate],
  )

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return commands

    const matchingCommands = commands.filter((c) =>
      c.label.toLowerCase().includes(q.toLowerCase()),
    )

    const hits = search(q, { tasks, notes, projects, events })
    const hitCommands: Command[] = hits.map((hit) => {
      const icons = {
        task: <CheckSquare className="size-4" />,
        note: <FileText className="size-4" />,
        project: <Folder className="size-4" />,
        event: <CalendarDays className="size-4" />,
      }
      return {
        id: `${hit.kind}-${hit.id}`,
        label: hit.title,
        hint: hit.subtitle,
        icon: icons[hit.kind],
        group: 'Results',
        run: () => {
          setOpen(false)
          if (hit.kind === 'task') openTask(hit.id)
          else if (hit.kind === 'note') navigate(`/notes/${hit.id}`)
          else if (hit.kind === 'project') navigate(`/projects/${hit.id}`)
          else navigate('/calendar')
        },
      }
    })

    return [...hitCommands, ...matchingCommands]
  }, [query, commands, tasks, notes, projects, events, navigate, openTask, setOpen])

  useEffect(() => setActive(0), [query])

  // Keep the highlighted row in view when navigating with the keyboard.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % Math.max(1, results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % Math.max(1, results.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      results[active]?.run()
    }
  }

  let lastGroup = ''

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[18%] max-w-lg translate-y-0 overflow-hidden p-0" hideClose>
        <DialogTitle className="sr-only">Search and commands</DialogTitle>

        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="size-4 shrink-0 text-faint" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search tasks, notes, projects…"
            className="flex-1 bg-transparent text-[15px] placeholder:text-faint focus:outline-none"
            aria-label="Search"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-faint">
              Nothing matches “{query}”
            </p>
          )}

          {results.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup
            lastGroup = cmd.group
            return (
              <div key={cmd.id}>
                {showGroup && (
                  <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                    {cmd.group}
                  </p>
                )}
                <button
                  data-index={i}
                  onClick={cmd.run}
                  onMouseMove={() => setActive(i)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-[13px] transition-colors',
                    i === active ? 'bg-elevated text-fg' : 'text-muted hover:text-fg',
                  )}
                >
                  <span className={cn('shrink-0', i === active ? 'text-accent' : 'text-faint')}>
                    {cmd.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                  {cmd.hint && (
                    <span className="shrink-0 text-[11px] text-faint">{cmd.hint}</span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

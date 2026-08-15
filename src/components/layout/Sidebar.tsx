import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  ChevronRight,
  ChevronsUpDown,
  CloudOff,
  FileText,
  Folder,
  Inbox,
  LayoutDashboard,
  Plus,
  Repeat,
  Search,
  Settings,
  Squircle,
  Users,
} from 'lucide-react'
import { isCloud } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { inboxTasks, todayTasks } from '@/store/selectors'
import { useUI } from '@/store/ui'
import { Avatar, Icon, Kbd } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/controls'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/menu'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-[7px] text-[13px] font-medium transition-colors',
    isActive ? 'bg-elevated text-fg' : 'text-muted hover:bg-elevated/60 hover:text-fg',
  )

function Count({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-auto text-[11px] tabular-nums text-faint">{n}</span>
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const tasks = useData((s) => s.tasks)
  const projects = useData((s) => s.projects)
  const members = useData((s) => s.members)
  const user = useData((s) => s.user)
  const syncing = useData((s) => s.syncing)
  const createProject = useData((s) => s.createProject)
  const workspace = useData((s) => s.workspace)
  const workspaces = useData((s) => s.workspaces)
  const switchWorkspace = useData((s) => s.switchWorkspace)

  const setPaletteOpen = useUI((s) => s.setPaletteOpen)
  const setQuickAddOpen = useUI((s) => s.setQuickAddOpen)

  const inboxCount = useMemo(() => inboxTasks(tasks).length, [tasks])
  const todayCount = useMemo(() => todayTasks(tasks).length, [tasks])
  const liveProjects = useMemo(
    () => projects.filter((p) => !p.archived).sort((a, b) => a.position - b.position),
    [projects],
  )

  const me = members.find((m) => m.user_id === user?.id)?.profile

  return (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="flex items-center gap-2 px-1.5 pb-2">
        <span className="grid size-6 place-items-center rounded-[7px] bg-fg text-bg">
          <Squircle className="size-3.5" strokeWidth={2.5} />
        </span>
        <span className="text-[14px] font-semibold tracking-tight">Atlas</span>
        {syncing && (
          <span className="ml-auto size-1.5 animate-pulse rounded-full bg-accent" aria-label="Saving" />
        )}
        {!isCloud && !syncing && (
          <Tooltip content="Local mode — data stays in this browser">
            <span className="ml-auto text-faint">
              <CloudOff className="size-3.5" />
            </span>
          </Tooltip>
        )}
      </div>

      {/* Only worth the space once there is somewhere to switch to. */}
      {workspaces.length > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="mb-2 flex items-center gap-2 rounded-[var(--radius-md)] border border-border px-2 py-1.5 text-left transition-colors hover:border-border-strong">
              <span
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-[6px]',
                  workspace?.owner_id === user?.id ? 'bg-elevated' : 'bg-accent-soft',
                )}
              >
                {workspace?.owner_id === user?.id ? (
                  <Folder className="size-3 text-muted" />
                ) : (
                  <Users className="size-3 text-accent" />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                {workspace?.name ?? 'Workspace'}
              </span>
              <ChevronsUpDown className="size-3 shrink-0 text-faint" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((w) => {
              const mine = w.owner_id === user?.id
              return (
                <DropdownMenuItem
                  key={w.id}
                  onSelect={() => {
                    void switchWorkspace(w.id)
                    onNavigate?.()
                  }}
                >
                  {mine ? <Folder className="size-4" /> : <Users className="size-4" />}
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  <span className="shrink-0 text-[10px] text-faint">
                    {mine ? 'Owner' : 'Shared'}
                  </span>
                  {w.id === workspace?.id && (
                    <Check className="size-3.5 shrink-0 text-accent" />
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <button
        onClick={() => {
          setQuickAddOpen(true)
          onNavigate?.()
        }}
        className="mb-1 flex items-center gap-2.5 rounded-[var(--radius-md)] bg-accent px-2.5 py-2 text-[13px] font-medium text-accent-fg transition-all hover:brightness-110 active:scale-[0.98]"
      >
        <Plus className="size-4" />
        Capture
        <Kbd className="ml-auto border-black/15 bg-black/10 text-accent-fg/70">C</Kbd>
      </button>

      <button
        onClick={() => {
          setPaletteOpen(true)
          onNavigate?.()
        }}
        className="mb-2 flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-[7px] text-[13px] font-medium text-muted transition-colors hover:bg-elevated/60 hover:text-fg"
      >
        <Search className="size-4" />
        Search
        <Kbd className="ml-auto">⌘K</Kbd>
      </button>

      <nav className="space-y-0.5" onClick={onNavigate}>
        <NavLink to="/" end className={linkClass}>
          <LayoutDashboard className="size-4" />
          Today
          <Count n={todayCount} />
        </NavLink>
        <NavLink to="/inbox" className={linkClass}>
          <Inbox className="size-4" />
          Inbox
          <Count n={inboxCount} />
        </NavLink>
        <NavLink to="/board" className={linkClass}>
          <Squircle className="size-4" />
          Board
        </NavLink>
        <NavLink to="/calendar" className={linkClass}>
          <CalendarDays className="size-4" />
          Calendar
        </NavLink>
        <NavLink to="/notes" className={linkClass}>
          <FileText className="size-4" />
          Notes
        </NavLink>
        <NavLink to="/habits" className={linkClass}>
          <Repeat className="size-4" />
          Habits
        </NavLink>
      </nav>

      <div className="mt-5 flex-1 overflow-y-auto">
        <div className="mb-1.5 flex items-center gap-1 px-2.5">
          <NavLink
            to="/projects"
            onClick={onNavigate}
            className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint transition-colors hover:text-muted"
          >
            Projects
            <ChevronRight className="size-3" />
          </NavLink>
          <button
            onClick={async () => {
              const p = await createProject({ name: 'New project' })
              if (p) {
                navigate(`/projects/${p.id}`)
                onNavigate?.()
              }
            }}
            className="ml-auto grid size-5 place-items-center rounded text-faint transition-colors hover:bg-elevated hover:text-fg"
            aria-label="New project"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <nav className="space-y-0.5" onClick={onNavigate}>
          {liveProjects.map((p) => {
            const open = tasks.filter((t) => t.project_id === p.id && t.status !== 'done').length
            return (
              <NavLink key={p.id} to={`/projects/${p.id}`} className={linkClass}>
                <Icon name={p.icon} className="size-4 shrink-0" style={{ color: p.color }} />
                <span className="truncate">{p.name}</span>
                <Count n={open} />
              </NavLink>
            )
          })}
          {!liveProjects.length && (
            <p className="px-2.5 py-1.5 text-[12px] text-faint">No projects yet</p>
          )}
        </nav>
      </div>

      <NavLink
        to="/settings"
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'mt-2 flex items-center gap-2.5 rounded-[var(--radius-md)] border-t border-border px-2.5 pb-1 pt-3 text-[13px] transition-colors',
            isActive ? 'text-fg' : 'text-muted hover:text-fg',
          )
        }
      >
        <Avatar
          name={me?.display_name ?? user?.display_name}
          email={me?.email ?? user?.email}
          src={me?.avatar_url}
          size={22}
        />
        <span className="min-w-0 flex-1 truncate font-medium">
          {me?.display_name ?? user?.display_name ?? user?.email ?? 'You'}
        </span>
        <Settings className="size-4 shrink-0 text-faint" />
      </NavLink>
    </div>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-surface/40 md:block">
      <SidebarContent />
    </aside>
  )
}

export function MobileNav() {
  const tasks = useData((s) => s.tasks)
  const inboxCount = useMemo(() => inboxTasks(tasks).length, [tasks])

  const items = [
    { to: '/', icon: LayoutDashboard, label: 'Today', end: true, badge: 0 },
    { to: '/inbox', icon: Inbox, label: 'Inbox', end: false, badge: inboxCount },
    { to: '/board', icon: Squircle, label: 'Board', end: false, badge: 0 },
    { to: '/calendar', icon: CalendarDays, label: 'Calendar', end: false, badge: 0 },
    { to: '/projects', icon: Folder, label: 'Projects', end: false, badge: 0 },
  ]

  return (
    <nav className="glass safe-b fixed inset-x-0 bottom-0 z-30 flex border-t border-border md:hidden">
      {items.map(({ to, icon: Icn, label, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors',
              isActive ? 'text-fg' : 'text-faint',
            )
          }
        >
          {({ isActive }) => (
            <>
              <span className="relative">
                <Icn className="size-[19px]" strokeWidth={isActive ? 2.4 : 1.9} />
                {badge > 0 && (
                  <span className="absolute -right-1.5 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-fg">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

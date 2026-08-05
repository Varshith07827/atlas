import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Plus, Search } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { useRealtime } from '@/hooks/useRealtime'
import { SHORTCUTS, useShortcuts } from '@/hooks/useShortcuts'
import { cn } from '@/lib/utils'
import { useUI } from '@/store/ui'
import { CommandPalette } from '@/components/CommandPalette'
import { QuickAdd } from '@/components/QuickAdd'
import { TaskDetail } from '@/components/task/TaskDetail'
import { Kbd } from '@/components/ui/misc'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/overlay'
import { MobileNav, Sidebar, SidebarContent } from './Sidebar'

/** Mobile-only top bar. Desktop gets its chrome from the sidebar instead. */
function MobileHeader({ onMenu }: { onMenu: () => void }) {
  const setPaletteOpen = useUI((s) => s.setPaletteOpen)
  const setQuickAddOpen = useUI((s) => s.setQuickAddOpen)

  return (
    <header className="glass safe-t sticky top-0 z-20 flex items-center gap-1 border-b border-border px-2 py-2 md:hidden">
      <button
        onClick={onMenu}
        className="grid size-9 place-items-center rounded-[var(--radius-md)] text-muted transition-colors active:bg-elevated"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <span className="ml-1 text-[15px] font-semibold tracking-tight">Atlas</span>
      <button
        onClick={() => setPaletteOpen(true)}
        className="ml-auto grid size-9 place-items-center rounded-[var(--radius-md)] text-muted transition-colors active:bg-elevated"
        aria-label="Search"
      >
        <Search className="size-5" />
      </button>
      <button
        onClick={() => setQuickAddOpen(true)}
        className="grid size-9 place-items-center rounded-[var(--radius-md)] text-accent transition-colors active:bg-elevated"
        aria-label="Capture a task"
      >
        <Plus className="size-5" strokeWidth={2.4} />
      </button>
    </header>
  )
}

function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="px-5 pb-5">
          <dl className="space-y-2">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center justify-between gap-4">
                <dt className="text-[13px] text-muted">{s.label}</dt>
                <dd>
                  <Kbd>{s.keys}</Kbd>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AppShell() {
  const sidebarOpen = useUI((s) => s.sidebarOpen)
  const setSidebarOpen = useUI((s) => s.setSidebarOpen)
  const [helpOpen, setHelpOpen] = useState(false)

  useShortcuts(useCallback(() => setHelpOpen(true), []))
  useRealtime()
  useNotifications()

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <Sidebar />

      {/* Mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0" hideClose>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader onMenu={() => setSidebarOpen(true)} />
        <main
          className={cn(
            'flex-1 overflow-y-auto overflow-x-hidden',
            // Clear the fixed tab bar on phones.
            'pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] md:pb-0',
          )}
        >
          <Outlet />
        </main>
      </div>

      <MobileNav />
      <CommandPalette />
      <QuickAdd />
      <TaskDetail />
      <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  )
}

/** Consistent page frame: max width, padding, heading. */
export function Page({
  title,
  subtitle,
  actions,
  children,
  wide,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-5 md:px-8 md:py-7',
        wide ? 'max-w-[100rem]' : 'max-w-3xl',
      )}
    >
      {(title || actions) && (
        <div className="mb-5 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {title && (
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.02em] md:text-[26px]">
                {title}
              </h1>
            )}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  )
}

import { Suspense, lazy, useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TriangleAlert } from 'lucide-react'

import { isCloud } from '@/lib/supabase'
import { auth } from '@/services/auth'
import type { AuthUser } from '@/services/backend'
import { useData } from '@/store/data'
import { applyTheme, useUI } from '@/store/ui'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/controls'
import { Skeleton } from '@/components/ui/misc'

import { BoardPage } from '@/pages/BoardPage'
import { Dashboard } from '@/pages/Dashboard'
import { HabitsPage } from '@/pages/HabitsPage'
import { InboxPage } from '@/pages/InboxPage'
import { LoginPage } from '@/pages/LoginPage'
import { ProjectDetail, ProjectsPage } from '@/pages/ProjectsPage'
import { SettingsPage } from '@/pages/SettingsPage'

// FullCalendar and the Markdown renderer are together about two thirds of the
// JavaScript here, and neither is needed to answer "what should I do now?".
// They load when you first open those screens.
const CalendarPage = lazy(() =>
  import('@/pages/CalendarPage').then((m) => ({ default: m.CalendarPage })),
)
const NotesPage = lazy(() =>
  import('@/pages/NotesPage').then((m) => ({ default: m.NotesPage })),
)
const NoteDetail = lazy(() =>
  import('@/pages/NotesPage').then((m) => ({ default: m.NoteDetail })),
)

function LoadingScreen() {
  return (
    <div className="flex h-dvh gap-0 bg-bg">
      <div className="hidden w-60 shrink-0 space-y-2 border-r border-border p-3 md:block">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-8 w-full" />
        <div className="pt-4" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-7 md:px-8">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  )
}

/** Placeholder while a lazily-loaded route arrives. */
function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-7 md:px-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="grid h-dvh place-items-center bg-bg px-6">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-11 place-items-center rounded-[var(--radius-lg)] bg-danger/12">
          <TriangleAlert className="size-5 text-danger" />
        </span>
        <h1 className="text-[17px] font-semibold">Could not load your workspace</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{message}</p>
        <p className="mt-3 text-[12px] leading-relaxed text-faint">
          If this is a fresh Supabase project, check that you ran{' '}
          <code className="font-mono">supabase/schema.sql</code> in the SQL editor.
        </p>
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

function AuthGate() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checking, setChecking] = useState(true)

  const status = useData((s) => s.status)
  const error = useData((s) => s.error)
  const load = useData((s) => s.load)
  const reset = useData((s) => s.reset)

  useEffect(() => {
    let alive = true
    auth.currentUser().then((u) => {
      if (!alive) return
      setUser(u)
      setChecking(false)
    })
    const unsubscribe = auth.onChange((u) => {
      setUser(u)
      setChecking(false)
      if (!u) reset()
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [reset])

  // Load the workspace once we know who we are. `status` guards against the
  // double-invoke that StrictMode does in development.
  useEffect(() => {
    if (user && status === 'idle') void load(user)
  }, [user, status, load])

  if (checking) return <LoadingScreen />
  if (!user) return isCloud ? <LoginPage /> : <LoadingScreen />
  if (status === 'error') {
    return (
      <ErrorScreen
        message={error ?? 'Something went wrong.'}
        onRetry={() => {
          reset()
          void load(user)
        }}
      />
    )
  }
  if (status !== 'ready') return <LoadingScreen />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="board" element={<BoardPage />} />
        <Route
          path="calendar"
          element={
            <Suspense fallback={<RouteFallback />}>
              <CalendarPage />
            </Suspense>
          }
        />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route
          path="notes"
          element={
            <Suspense fallback={<RouteFallback />}>
              <NotesPage />
            </Suspense>
          }
        />
        <Route
          path="notes/:id"
          element={
            <Suspense fallback={<RouteFallback />}>
              <NoteDetail />
            </Suspense>
          }
        />
        <Route path="habits" element={<HabitsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const theme = useUI((s) => s.theme)
  const settingsTheme = useData((s) => s.settings?.theme)

  // The stored theme wins on first paint (see index.html); once the workspace
  // loads, the saved preference takes over so it follows you between devices.
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (settingsTheme && settingsTheme !== theme) {
      useUI.getState().setTheme(settingsTheme)
    }
    // Only react to what came back from the backend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsTheme])

  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      <HashRouter>
        <AuthGate />
      </HashRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: 'atlas-toast',
          style: {
            background: 'var(--color-elevated)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-fg)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
          },
        }}
      />
    </TooltipProvider>
  )
}

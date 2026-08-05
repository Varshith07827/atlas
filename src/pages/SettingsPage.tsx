import { useState } from 'react'
import {
  Bell,
  CloudOff,
  Download,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  notificationPermission,
  requestNotificationPermission,
} from '@/hooks/useNotifications'
import { isCloud } from '@/lib/supabase'
import { auth } from '@/services/auth'
import { LocalBackend } from '@/services/localBackend'
import { onEnter } from '@/lib/keys'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { useUI } from '@/store/ui'
import type { ThemeMode } from '@/types'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from '@/components/ui/controls'
import { ConfirmDialog } from '@/components/ui/overlay'
import { Avatar } from '@/components/ui/misc'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-muted">{description}</p>}
      </div>
      <div className="card divide-hairline overflow-hidden">{children}</div>
    </section>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">{label}</p>
        {hint && <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{hint}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

export function SettingsPage() {
  const settings = useData((s) => s.settings)
  const updateSettings = useData((s) => s.updateSettings)
  const user = useData((s) => s.user)
  const workspace = useData((s) => s.workspace)
  const members = useData((s) => s.members)
  const inviteMember = useData((s) => s.inviteMember)
  const removeMember = useData((s) => s.removeMember)
  const state = useData()

  const theme = useUI((s) => s.theme)
  const setTheme = useUI((s) => s.setTheme)

  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [permission, setPermission] = useState(notificationPermission())

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviting(true)
    await inviteMember(inviteEmail)
    setInviting(false)
    setInviteEmail('')
  }

  const enableNotifications = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission()
      setPermission(notificationPermission())
      if (!granted) {
        toast.error('Your browser blocked notifications. Enable them in site settings.')
        return
      }
    }
    void updateSettings({ notifications_enabled: enabled })
  }

  /** Everything the app holds, as one JSON file. No lock-in. */
  const exportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      workspace,
      projects: state.projects,
      tasks: state.tasks,
      labels: state.labels,
      task_labels: state.task_labels,
      notes: state.notes,
      events: state.events,
      habits: state.habits,
      habit_logs: state.habit_logs,
      settings,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atlas-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported')
  }

  const themes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'dark', label: 'Dark', icon: <Moon className="size-3.5" /> },
    { value: 'light', label: 'Light', icon: <Sun className="size-3.5" /> },
    { value: 'system', label: 'System', icon: <Monitor className="size-3.5" /> },
  ]

  return (
    <Page title="Settings">
      <div className="space-y-7">
        <Section title="Appearance">
          <Row label="Theme">
            <div className="flex gap-1 rounded-[var(--radius-md)] border border-border bg-elevated p-0.5">
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => {
                    // Both: the UI store drives this tab immediately, the saved
                    // setting is what follows you to your other devices.
                    setTheme(t.value)
                    void updateSettings({ theme: t.value })
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1 text-[12px] font-medium transition-colors',
                    theme === t.value ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                  )}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Week starts on">
            <Select
              value={String(settings?.week_start ?? 1)}
              onValueChange={(v) => void updateSettings({ week_start: Number(v) as 0 | 1 })}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="0">Sunday</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Default calendar view">
            <Select
              value={settings?.default_calendar_view ?? 'timeGridWeek'}
              onValueChange={(v) =>
                void updateSettings({
                  default_calendar_view: v as 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay',
                })
              }
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dayGridMonth">Month</SelectItem>
                <SelectItem value="timeGridWeek">Week</SelectItem>
                <SelectItem value="timeGridDay">Day</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </Section>

        <Section
          title="Notifications"
          description="Atlas has no server, so reminders only fire while a tab is open."
        >
          <Row
            label="Browser notifications"
            hint={
              permission === 'denied'
                ? 'Blocked by your browser — turn them back on in site settings.'
                : permission === 'unsupported'
                  ? 'This browser does not support notifications.'
                  : undefined
            }
          >
            <Switch
              checked={settings?.notifications_enabled ?? false}
              onCheckedChange={enableNotifications}
              disabled={permission === 'denied' || permission === 'unsupported'}
            />
          </Row>
          <Row label="Daily summary of what's due">
            <Switch
              checked={settings?.notify_due_today ?? true}
              onCheckedChange={(v) => void updateSettings({ notify_due_today: v })}
              disabled={!settings?.notifications_enabled}
            />
          </Row>
          <Row label="Remind me before scheduled blocks">
            <Select
              value={String(settings?.reminder_lead_minutes ?? 10)}
              onValueChange={(v) => void updateSettings({ reminder_lead_minutes: Number(v) })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Never</SelectItem>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="10">10 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          {settings?.notifications_enabled && permission === 'granted' && (
            <Row label="Send a test notification">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => new Notification('Atlas', { body: 'Notifications are working.' })}
              >
                <Bell className="size-3.5" />
                Test
              </Button>
            </Row>
          )}
        </Section>

        <Section title="Account">
          <Row label="Display name">
            <div className="flex items-center gap-2">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onBlur={async () => {
                  const next = displayName.trim()
                  if (!next || next === user?.display_name) return
                  await auth.updateDisplayName(next)
                  toast.success('Name updated')
                }}
                className="w-44"
                placeholder="Your name"
              />
            </div>
          </Row>
          <Row label="Email" hint={user?.email} />
          {isCloud ? (
            <Row label="Sign out">
              <Button variant="secondary" size="sm" onClick={() => void auth.signOut()}>
                <LogOut className="size-3.5" />
                Sign out
              </Button>
            </Row>
          ) : (
            <Row
              label="Local mode"
              hint="Data lives in this browser only. Add Supabase credentials to sync across devices and share with a friend."
            >
              <CloudOff className="size-4 text-faint" />
            </Row>
          )}
        </Section>

        <Section
          title="Workspace"
          description={
            isCloud
              ? `${workspace?.name ?? 'Workspace'} — invite one friend to share projects and tasks.`
              : 'Sharing needs a Supabase project.'
          }
        >
          {members.map((m) => (
            <Row
              key={m.user_id}
              label={m.profile?.display_name ?? m.profile?.email ?? 'Member'}
              hint={m.role === 'owner' ? 'Owner' : m.profile?.email ?? undefined}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  name={m.profile?.display_name}
                  email={m.profile?.email}
                  src={m.profile?.avatar_url}
                  size={26}
                />
                {m.role !== 'owner' && m.user_id !== user?.id && (
                  <button
                    onClick={() => void removeMember(m.user_id)}
                    className="grid size-6 place-items-center rounded text-faint transition-colors hover:text-danger"
                    aria-label="Remove member"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </Row>
          ))}

          {isCloud && (
            <div className="px-3.5 py-3">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void sendInvite()
                }}
              >
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={onEnter(() => void sendInvite())}
                  placeholder="friend@example.com"
                  className="flex-1"
                />
                <Button type="submit" variant="secondary" size="sm" disabled={inviting}>
                  <UserPlus className="size-3.5" />
                  Invite
                </Button>
              </form>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                They need an Atlas account first — there is no server to send an invite email
                from. Ask them to sign up, then add their address here.
              </p>
            </div>
          )}
        </Section>

        <Section title="Data">
          <Row label="Export everything" hint="One JSON file with all your tasks, notes and habits.">
            <Button variant="secondary" size="sm" onClick={exportData}>
              <Download className="size-3.5" />
              Export
            </Button>
          </Row>
          {!isCloud && (
            <Row
              label="Reset local data"
              hint="Deletes everything stored in this browser and starts fresh."
            >
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmReset(true)}
              >
                <Trash2 className="size-3.5" />
                Reset
              </Button>
            </Row>
          )}
        </Section>

        <p className="pb-4 text-center text-[11px] text-faint">
          Atlas · {isCloud ? 'Synced with Supabase' : 'Local mode'}
        </p>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset all local data?"
        description="Every task, note and habit in this browser will be deleted. Export first if you want a copy."
        confirmLabel="Delete everything"
        onConfirm={() => {
          LocalBackend.wipe()
          window.location.reload()
        }}
      />
    </Page>
  )
}

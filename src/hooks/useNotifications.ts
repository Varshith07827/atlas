import { useCallback, useEffect, useRef } from 'react'
import { parseISO, today } from '@/lib/date'
import { useData } from '@/store/data'

const CHECK_INTERVAL_MS = 60_000
const DIGEST_KEY = 'atlas.lastDueDigest'

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function show(title: string, body?: string, tag?: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      tag,
      icon: `${import.meta.env.BASE_URL}icon-192.png`,
      badge: `${import.meta.env.BASE_URL}icon-192.png`,
    })
  } catch {
    // Some browsers only allow notifications from a service worker context.
    // Failing quietly is right here: a missed reminder shouldn't break the app.
  }
}

/**
 * Fires browser notifications for scheduled reminders and a once-a-day digest
 * of what's due.
 *
 * There is no server, so this only runs while a tab is open. That's an honest
 * limitation of a static app, and the Settings screen says so rather than
 * implying reminders will reach a closed laptop.
 */
export function useNotifications() {
  const settings = useData((s) => s.settings)
  const notifications = useData((s) => s.notifications)
  const tasks = useData((s) => s.tasks)
  const markDelivered = useData((s) => s.markNotificationDelivered)
  const scheduleNotification = useData((s) => s.scheduleNotification)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const tick = useCallback(() => {
    if (!settings?.notifications_enabled) return
    if (notificationPermission() !== 'granted') return

    const now = Date.now()

    // 1. Reminders that have come due.
    for (const n of notifications) {
      if (n.delivered_at) continue
      if (parseISO(n.fire_at).getTime() > now) continue
      show(n.title, n.body ?? undefined, n.id)
      void markDelivered(n.id)
    }

    // 2. Lead-time reminders for anything scheduled on the calendar.
    if (settings.reminder_lead_minutes > 0) {
      const lead = settings.reminder_lead_minutes * 60_000
      for (const task of tasks) {
        if (task.status === 'done' || !task.scheduled_start) continue
        const start = parseISO(task.scheduled_start).getTime()
        const fireAt = start - lead
        if (fireAt > now || start < now) continue
        const already = notifications.some((n) => n.task_id === task.id && n.delivered_at)
        if (already) continue
        show(task.title, `Starts in ${settings.reminder_lead_minutes} minutes`, task.id)
        void scheduleNotification({
          task_id: task.id,
          title: task.title,
          body: `Starts in ${settings.reminder_lead_minutes} minutes`,
          fire_at: new Date(fireAt).toISOString(),
          read_at: null,
          delivered_at: new Date().toISOString(),
        })
      }
    }

    // 3. One "what's due today" summary per day.
    if (settings.notify_due_today) {
      const stamp = today()
      if (localStorage.getItem(DIGEST_KEY) !== stamp && new Date().getHours() >= 8) {
        const due = tasks.filter((t) => t.status !== 'done' && t.due_date === stamp)
        if (due.length) {
          show(
            `${due.length} task${due.length === 1 ? '' : 's'} due today`,
            due
              .slice(0, 3)
              .map((t) => t.title)
              .join(' · '),
            'due-digest',
          )
        }
        localStorage.setItem(DIGEST_KEY, stamp)
      }
    }
  }, [markDelivered, notifications, scheduleNotification, settings, tasks])

  useEffect(() => {
    if (!settings?.notifications_enabled) return
    tick()
    timer.current = setInterval(tick, CHECK_INTERVAL_MS)
    return () => clearInterval(timer.current)
  }, [settings?.notifications_enabled, tick])
}

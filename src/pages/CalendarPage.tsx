import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { Draggable } from '@fullcalendar/interaction'
import type { EventClickArg, EventDropArg } from '@fullcalendar/core'
import { CalendarPlus, GripVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { addMinutes, formatTimeRange } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { useUI } from '@/store/ui'
import type { CalendarEvent } from '@/types'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlay'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/controls'
import { EmptyState, Icon } from '@/components/ui/misc'

type ViewName = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'

/** Trim a datetime for `<input type="datetime-local">`, which wants local time. */
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string) {
  return new Date(value).toISOString()
}

export function CalendarPage() {
  const events = useData((s) => s.events)
  const tasks = useData((s) => s.tasks)
  const projects = useData((s) => s.projects)
  const settings = useData((s) => s.settings)
  const createEvent = useData((s) => s.createEvent)
  const updateEvent = useData((s) => s.updateEvent)
  const deleteEvent = useData((s) => s.deleteEvent)
  const scheduleTask = useData((s) => s.scheduleTask)
  const openTask = useUI((s) => s.openTask)

  const isDesktop = useIsDesktop()
  const calendarRef = useRef<FullCalendar>(null)
  const trayRef = useRef<HTMLDivElement>(null)

  const [view, setView] = useState<ViewName>(
    settings?.default_calendar_view ?? 'timeGridWeek',
  )
  const [editing, setEditing] = useState<CalendarEvent | null>(null)
  const [draft, setDraft] = useState<{ title: string; start: string; end: string; location: string }>(
    { title: '', start: '', end: '', location: '' },
  )

  /** Tasks with a due date or no schedule yet — candidates for time-blocking. */
  const unscheduled = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'done' && !t.scheduled_start)
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 30),
    [tasks],
  )

  // Register the tray as an external drag source for FullCalendar.
  useEffect(() => {
    if (!trayRef.current) return
    const draggable = new Draggable(trayRef.current, {
      itemSelector: '[data-task-id]',
      eventData: (el) => ({
        title: el.getAttribute('data-title') ?? '',
        duration: { minutes: Number(el.getAttribute('data-duration') || 30) },
      }),
    })
    return () => draggable.destroy()
  }, [unscheduled.length])

  const fcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start_at,
        end: e.end_at,
        allDay: e.all_day,
        backgroundColor: e.color ?? undefined,
        borderColor: 'transparent',
        extendedProps: { taskId: e.task_id },
      })),
    [events],
  )

  const openEditor = (event: CalendarEvent) => {
    setEditing(event)
    setDraft({
      title: event.title,
      start: toLocalInput(event.start_at),
      end: toLocalInput(event.end_at),
      location: event.location ?? '',
    })
  }

  const onEventClick = (arg: EventClickArg) => {
    const taskId = arg.event.extendedProps.taskId as string | null
    if (taskId) {
      openTask(taskId)
      return
    }
    const event = events.find((e) => e.id === arg.event.id)
    if (event) openEditor(event)
  }

  const onEventChange = (arg: EventDropArg | { event: EventDropArg['event']; revert: () => void }) => {
    const event = events.find((e) => e.id === arg.event.id)
    if (!event || !arg.event.start) {
      arg.revert()
      return
    }
    const start = arg.event.start.toISOString()
    const end = (arg.event.end ?? new Date(arg.event.start.getTime() + 30 * 60_000)).toISOString()
    void updateEvent(event.id, { start_at: start, end_at: end, all_day: arg.event.allDay })
  }

  return (
    <Page
      wide
      title="Calendar"
      subtitle="Drag a task from the tray to block time for it."
      actions={
        <Tabs value={view} onValueChange={(v) => {
          const next = v as ViewName
          setView(next)
          calendarRef.current?.getApi().changeView(next)
        }}>
          <TabsList>
            <TabsTrigger value="dayGridMonth">Month</TabsTrigger>
            <TabsTrigger value="timeGridWeek">Week</TabsTrigger>
            <TabsTrigger value="timeGridDay">Day</TabsTrigger>
          </TabsList>
        </Tabs>
      }
    >
      <div className="flex gap-5">
        <div className="min-w-0 flex-1">
          <div className="card p-2 md:p-3">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={view}
              headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
              buttonText={{ today: 'Today' }}
              height="auto"
              expandRows
              nowIndicator
              editable
              droppable
              selectable
              selectMirror
              dayMaxEvents={3}
              firstDay={settings?.week_start ?? 1}
              slotMinTime="06:00:00"
              slotMaxTime="23:00:00"
              scrollTime="08:00:00"
              slotDuration="00:30:00"
              allDaySlot={view !== 'dayGridMonth'}
              events={fcEvents}
              eventClick={onEventClick}
              eventDrop={onEventChange}
              eventResize={onEventChange}
              select={(info) => {
                void createEvent({
                  title: 'New event',
                  start_at: info.start.toISOString(),
                  end_at: info.end.toISOString(),
                  all_day: info.allDay,
                })
                calendarRef.current?.getApi().unselect()
              }}
              /* A task dropped from the tray becomes a scheduled block. */
              eventReceive={(info) => {
                const taskId = info.draggedEl.getAttribute('data-task-id')
                const start = info.event.start
                // The mirror element is ours to remove; the store owns the truth.
                info.event.remove()
                if (!taskId || !start) return
                const task = tasks.find((t) => t.id === taskId)
                const startISO = start.toISOString()
                void scheduleTask(
                  taskId,
                  startISO,
                  addMinutes(startISO, task?.estimate_minutes ?? 30),
                )
                toast.success('Scheduled', { description: task?.title, duration: 1600 })
              }}
            />
          </div>
        </div>

        {isDesktop && (
          <aside className="w-64 shrink-0">
            <p className="mb-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
              <CalendarPlus className="size-3" />
              Unscheduled
            </p>
            <div
              ref={trayRef}
              className="card max-h-[calc(100dvh-12rem)] space-y-1.5 overflow-y-auto p-2"
            >
              {unscheduled.map((task) => {
                const project = projects.find((p) => p.id === task.project_id)
                return (
                  <div
                    key={task.id}
                    data-task-id={task.id}
                    data-title={task.title}
                    data-duration={task.estimate_minutes ?? 30}
                    className={cn(
                      'group flex cursor-grab items-start gap-2 rounded-[var(--radius-sm)] border border-border bg-elevated px-2 py-1.5',
                      'transition-colors hover:border-border-strong active:cursor-grabbing',
                    )}
                  >
                    <GripVertical className="mt-0.5 size-3 shrink-0 text-faint" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] leading-snug">{task.title}</p>
                      {project && (
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                          <Icon
                            name={project.icon}
                            className="size-2.5"
                            style={{ color: project.color }}
                          />
                          {project.name}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
              {!unscheduled.length && (
                <EmptyState
                  icon="CalendarCheck"
                  title="All scheduled"
                  description="Every open task already has a slot."
                  className="py-8"
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Event editor */}
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Event</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Field label="Title">
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                autoFocus
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts">
                <Input
                  type="datetime-local"
                  value={draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="datetime-local"
                  value={draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Location">
              <Input
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                placeholder="Optional"
              />
            </Field>
            {editing && (
              <p className="text-[12px] text-faint">
                {formatTimeRange(editing.start_at, editing.end_at, editing.all_day)}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              className="mr-auto text-danger hover:text-danger"
              onClick={() => {
                if (editing) void deleteEvent(editing.id)
                setEditing(null)
              }}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                if (!editing) return
                void updateEvent(editing.id, {
                  title: draft.title.trim() || 'Untitled',
                  start_at: fromLocalInput(draft.start),
                  end_at: fromLocalInput(draft.end),
                  location: draft.location.trim() || null,
                })
                setEditing(null)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  )
}

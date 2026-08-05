import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  CalendarDays,
  Flag,
  Folder,
  Lock,
  MessageSquare,
  Plus,
  Tag,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import {
  addMinutes,
  formatDue,
  formatDuration,
  formatRelative,
  formatTimeRange,
} from '@/lib/date'
import { onEnter } from '@/lib/keys'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { labelsForTask } from '@/store/selectors'
import { useUI } from '@/store/ui'
import {
  PRIORITY_COLOR,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TASK_STATUSES,
  type TaskStatus,
} from '@/types'
import { Button } from '@/components/ui/button'
import { AutoTextarea } from '@/components/ui/field'
import { Checkbox } from '@/components/ui/controls'
import { Avatar, Icon } from '@/components/ui/misc'
import { ConfirmDialog, Sheet, SheetContent, SheetTitle } from '@/components/ui/overlay'
import { DueDatePicker, EstimateMenu, LabelMenu, PriorityMenu, ProjectMenu } from './pickers'

/** A metadata row: icon + label on the left, editable control on the right. */
function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="flex w-24 shrink-0 items-center gap-2 text-[12px] text-faint">
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

const chip =
  'inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 text-[13px] text-fg transition-colors hover:bg-elevated max-w-full'

export function TaskDetail() {
  const openTaskId = useUI((s) => s.openTaskId)
  const openTask = useUI((s) => s.openTask)

  const task = useData((s) => s.tasks.find((t) => t.id === openTaskId) ?? null)
  const projects = useData((s) => s.projects)
  const labels = useData((s) => s.labels)
  const taskLabels = useData((s) => s.task_labels)
  const comments = useData((s) => s.comments)
  const members = useData((s) => s.members)

  const updateTask = useData((s) => s.updateTask)
  const deleteTask = useData((s) => s.deleteTask)
  const setTaskLabels = useData((s) => s.setTaskLabels)
  const createLabel = useData((s) => s.createLabel)
  const addSubtask = useData((s) => s.addSubtask)
  const toggleSubtask = useData((s) => s.toggleSubtask)
  const removeSubtask = useData((s) => s.removeSubtask)
  const scheduleTask = useData((s) => s.scheduleTask)
  const unscheduleTask = useData((s) => s.unscheduleTask)
  const addComment = useData((s) => s.addComment)
  const deleteComment = useData((s) => s.deleteComment)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [subtaskDraft, setSubtaskDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Local drafts so typing stays snappy; they sync down whenever a different
  // task is opened, and back up on blur.
  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description ?? '')
    setSubtaskDraft('')
    setCommentDraft('')
  }, [task?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const myLabels = useMemo(
    () => (task ? labelsForTask(task.id, labels, taskLabels) : []),
    [task, labels, taskLabels],
  )
  const myComments = useMemo(
    () =>
      comments
        .filter((c) => c.entity_type === 'task' && c.entity_id === task?.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [comments, task?.id],
  )

  if (!task) return null

  const project = projects.find((p) => p.id === task.project_id)
  const done = task.status === 'done'

  const commitTitle = () => {
    const next = title.trim()
    if (next && next !== task.title) void updateTask(task.id, { title: next })
    else if (!next) setTitle(task.title)
  }

  const commitDescription = () => {
    const next = description.trim()
    if (next !== (task.description ?? '')) {
      void updateTask(task.id, { description: next || null })
    }
  }

  const addSubtaskFromDraft = () => {
    if (!subtaskDraft.trim()) return
    void addSubtask(task.id, subtaskDraft)
    setSubtaskDraft('')
  }

  const addCommentFromDraft = () => {
    if (!commentDraft.trim()) return
    void addComment('task', task.id, commentDraft)
    setCommentDraft('')
  }

  /** Put the task on today's calendar at the next round hour. */
  const scheduleNow = () => {
    const start = new Date()
    start.setMinutes(0, 0, 0)
    start.setHours(start.getHours() + 1)
    const startISO = start.toISOString()
    void scheduleTask(task.id, startISO, addMinutes(startISO, task.estimate_minutes ?? 30))
  }

  return (
    <>
      <Sheet open={Boolean(openTaskId)} onOpenChange={(open) => !open && openTask(null)}>
        <SheetContent side="right" className="p-0">
          <SheetTitle className="sr-only">{task.title}</SheetTitle>

          <div className="flex items-center gap-2 border-b border-border px-4 py-3 pr-12">
            <select
              value={task.status}
              onChange={(e) => void updateTask(task.id, { status: e.target.value as TaskStatus })}
              className="h-7 rounded-[var(--radius-sm)] border border-border bg-elevated px-2 text-[12px] font-medium text-fg focus:outline-none"
              aria-label="Status"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            {task.is_private && (
              <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                <Lock className="size-3" />
                Private
              </span>
            )}
            <span className="ml-auto text-[11px] text-faint">
              {formatRelative(task.updated_at)}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={done}
                onCheckedChange={() =>
                  void updateTask(task.id, {
                    status: done ? 'today' : 'done',
                    completed_at: done ? null : new Date().toISOString(),
                  })
                }
                className="mt-1.5"
                aria-label="Complete task"
              />
              <AutoTextarea
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.blur()
                  }
                }}
                minRows={1}
                className={cn(
                  'border-0 bg-transparent px-0 text-[17px] font-semibold leading-snug focus:ring-0',
                  done && 'text-faint line-through',
                )}
                aria-label="Task title"
              />
            </div>

            <div className="mt-3">
              <AutoTextarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={commitDescription}
                placeholder="Add a description…"
                minRows={2}
                className="border-0 bg-transparent px-0 text-[13px] text-muted focus:ring-0"
                aria-label="Description"
              />
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <Row icon={<Flag className="size-3.5" />} label="Priority">
                <PriorityMenu
                  value={task.priority}
                  onChange={(priority) => void updateTask(task.id, { priority })}
                >
                  <button className={chip}>
                    <Flag className="size-3.5" style={{ color: PRIORITY_COLOR[task.priority] }} />
                    {PRIORITY_LABEL[task.priority]}
                  </button>
                </PriorityMenu>
              </Row>

              <Row icon={<CalendarDays className="size-3.5" />} label="Due">
                <DueDatePicker
                  value={task.due_date}
                  onChange={(due_date) => void updateTask(task.id, { due_date })}
                >
                  <button className={cn(chip, !task.due_date && 'text-faint')}>
                    <CalendarDays className="size-3.5" />
                    {task.due_date ? formatDue(task.due_date) : 'No date'}
                  </button>
                </DueDatePicker>
              </Row>

              <Row icon={<Folder className="size-3.5" />} label="Project">
                <ProjectMenu
                  value={task.project_id}
                  projects={projects}
                  onChange={(project_id) => void updateTask(task.id, { project_id })}
                >
                  <button className={cn(chip, !project && 'text-faint')}>
                    <Icon
                      name={project?.icon ?? 'Folder'}
                      className="size-3.5"
                      style={{ color: project?.color }}
                    />
                    <span className="truncate">{project?.name ?? 'No project'}</span>
                  </button>
                </ProjectMenu>
              </Row>

              <Row icon={<Tag className="size-3.5" />} label="Labels">
                <LabelMenu
                  selected={myLabels.map((l) => l.id)}
                  labels={labels}
                  onChange={(ids) => void setTaskLabels(task.id, ids)}
                  onCreate={async (name) => {
                    const label = await createLabel(name, 'oklch(68% 0.14 260)')
                    if (label) void setTaskLabels(task.id, [...myLabels.map((l) => l.id), label.id])
                  }}
                >
                  <button className={cn(chip, !myLabels.length && 'text-faint')}>
                    {myLabels.length ? (
                      <span className="flex flex-wrap items-center gap-1">
                        {myLabels.map((l) => (
                          <span
                            key={l.id}
                            className="rounded-full px-1.5 py-0.5 text-[11px] leading-none"
                            style={{
                              color: l.color,
                              background: `color-mix(in oklab, ${l.color} 14%, transparent)`,
                            }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <>
                        <Tag className="size-3.5" />
                        Add labels
                      </>
                    )}
                  </button>
                </LabelMenu>
              </Row>

              <Row icon={<Timer className="size-3.5" />} label="Estimate">
                <EstimateMenu
                  value={task.estimate_minutes}
                  onChange={(estimate_minutes) => void updateTask(task.id, { estimate_minutes })}
                >
                  <button className={cn(chip, task.estimate_minutes == null && 'text-faint')}>
                    <Timer className="size-3.5" />
                    {task.estimate_minutes != null
                      ? formatDuration(task.estimate_minutes)
                      : 'No estimate'}
                  </button>
                </EstimateMenu>
              </Row>

              <Row icon={<CalendarClock className="size-3.5" />} label="Scheduled">
                {task.scheduled_start && task.scheduled_end ? (
                  <span className="flex items-center gap-1.5">
                    <span className="text-[13px] tabular-nums">
                      {formatTimeRange(task.scheduled_start, task.scheduled_end, false)}
                    </span>
                    <button
                      onClick={() => void unscheduleTask(task.id)}
                      className="grid size-5 place-items-center rounded text-faint hover:bg-elevated hover:text-danger"
                      aria-label="Remove from calendar"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ) : (
                  <button onClick={scheduleNow} className={cn(chip, 'text-faint')}>
                    <CalendarClock className="size-3.5" />
                    Put on calendar
                  </button>
                )}
              </Row>
            </div>

            {/* Subtasks */}
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">
                Subtasks
                {task.subtasks.length > 0 && (
                  <span className="ml-1.5 font-normal tabular-nums">
                    {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                  </span>
                )}
              </p>
              <div className="space-y-0.5">
                {task.subtasks.map((sub) => (
                  <div key={sub.id} className="group flex items-center gap-2.5 py-1">
                    <Checkbox
                      checked={sub.done}
                      onCheckedChange={() => void toggleSubtask(task.id, sub.id)}
                      aria-label={sub.title}
                    />
                    <span
                      className={cn(
                        'flex-1 text-[13px]',
                        sub.done && 'text-faint line-through',
                      )}
                    >
                      {sub.title}
                    </span>
                    <button
                      onClick={() => void removeSubtask(task.id, sub.id)}
                      className="grid size-5 place-items-center rounded text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      aria-label={`Remove ${sub.title}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  addSubtaskFromDraft()
                }}
                className="mt-1 flex items-center gap-2.5"
              >
                <Plus className="size-3.5 shrink-0 text-faint" />
                <input
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  onKeyDown={onEnter(addSubtaskFromDraft)}
                  placeholder="Add a subtask"
                  className="flex-1 bg-transparent py-1 text-[13px] placeholder:text-faint focus:outline-none"
                />
              </form>
            </div>

            {/* Comments */}
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
                <MessageSquare className="size-3" />
                Comments
              </p>
              <div className="space-y-3">
                {myComments.map((c) => {
                  const author = members.find((m) => m.user_id === c.created_by)?.profile
                  return (
                    <div key={c.id} className="group flex items-start gap-2.5">
                      <Avatar
                        name={author?.display_name}
                        email={author?.email}
                        src={author?.avatar_url}
                        size={22}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-baseline gap-2">
                          <span className="text-[12px] font-medium">
                            {author?.display_name ?? author?.email ?? 'Someone'}
                          </span>
                          <span className="text-[10px] text-faint">
                            {formatRelative(c.created_at)}
                          </span>
                        </p>
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
                          {c.body}
                        </p>
                      </div>
                      <button
                        onClick={() => void deleteComment(c.id)}
                        className="grid size-5 shrink-0 place-items-center rounded text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                        aria-label="Delete comment"
                      >
                        <X className="size-3" />
                      </button>
                    </div>
                  )
                })}
                {!myComments.length && (
                  <p className="text-[12px] text-faint">No comments yet.</p>
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  addCommentFromDraft()
                }}
                className="mt-3"
              >
                <input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={onEnter(addCommentFromDraft)}
                  placeholder="Write a comment…"
                  className="h-9 w-full rounded-[var(--radius-md)] border border-border bg-elevated px-3 text-[13px] placeholder:text-faint focus:border-accent/60 focus:outline-none"
                />
              </form>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void updateTask(task.id, { is_private: !task.is_private })}
            >
              <Lock className="size-3.5" />
              {task.is_private ? 'Make shared' : 'Make private'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-danger hover:text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this task?"
        description={`"${task.title}" and its subtasks will be removed. This can't be undone.`}
        onConfirm={() => {
          openTask(null)
          void deleteTask(task.id)
        }}
      />
    </>
  )
}

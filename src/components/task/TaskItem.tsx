import { memo, useMemo } from 'react'
import { Flag, ListTree, Lock, Timer } from 'lucide-react'
import { formatDuration } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { labelsForTask } from '@/store/selectors'
import { useUI } from '@/store/ui'
import { PRIORITY_COLOR, type Task } from '@/types'
import { Checkbox } from '@/components/ui/controls'
import { Icon } from '@/components/ui/misc'
import { DueChip, LabelChips } from './pickers'

interface TaskItemProps {
  task: Task
  /** Hide the project chip when the surrounding list is already one project. */
  hideProject?: boolean
  compact?: boolean
  className?: string
}

/**
 * One row in any task list.
 *
 * Memoised on the task reference: the store replaces only the rows that change,
 * so ticking one checkbox re-renders one row rather than the whole list.
 */
export const TaskItem = memo(function TaskItem({
  task,
  hideProject,
  compact,
  className,
}: TaskItemProps) {
  const toggleTask = useData((s) => s.toggleTask)
  const projects = useData((s) => s.projects)
  const labels = useData((s) => s.labels)
  const taskLabels = useData((s) => s.task_labels)
  const openTask = useUI((s) => s.openTask)

  const project = projects.find((p) => p.id === task.project_id)
  const myLabels = useMemo(
    () => labelsForTask(task.id, labels, taskLabels),
    [task.id, labels, taskLabels],
  )

  const done = task.status === 'done'
  const subtasksDone = task.subtasks.filter((s) => s.done).length

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-3 transition-colors',
        compact ? 'py-2' : 'py-2.5',
        'hover:bg-elevated/60',
        className,
      )}
    >
      <Checkbox
        checked={done}
        onCheckedChange={() => void toggleTask(task.id)}
        className="mt-0.5 shrink-0"
        aria-label={done ? `Mark ${task.title} as not done` : `Complete ${task.title}`}
      />

      <button
        onClick={() => openTask(task.id)}
        className="min-w-0 flex-1 text-left"
        aria-label={`Open ${task.title}`}
      >
        <span className="flex items-center gap-1.5">
          {task.priority < 4 && (
            <Flag
              className="size-3 shrink-0"
              style={{ color: PRIORITY_COLOR[task.priority] }}
              aria-label={`Priority ${task.priority}`}
            />
          )}
          <span
            className={cn(
              'block truncate text-[14px] leading-snug transition-all',
              done ? 'text-faint line-through' : 'text-fg',
            )}
          >
            {task.title}
          </span>
          {task.is_private && <Lock className="size-3 shrink-0 text-faint" />}
        </span>

        {(task.due_date ||
          project ||
          myLabels.length > 0 ||
          task.estimate_minutes ||
          task.subtasks.length > 0) && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <DueChip due={done ? null : task.due_date} />

            {task.estimate_minutes != null && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted tabular-nums">
                <Timer className="size-3" />
                {formatDuration(task.estimate_minutes)}
              </span>
            )}

            {task.subtasks.length > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[11px] tabular-nums',
                  subtasksDone === task.subtasks.length ? 'text-success' : 'text-muted',
                )}
              >
                <ListTree className="size-3" />
                {subtasksDone}/{task.subtasks.length}
              </span>
            )}

            <LabelChips labels={myLabels} />

            {project && !hideProject && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                <Icon name={project.icon} className="size-3" style={{ color: project.color }} />
                {project.name}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  )
})

export function TaskList({
  tasks,
  hideProject,
  compact,
  className,
}: {
  tasks: Task[]
  hideProject?: boolean
  compact?: boolean
  className?: string
}) {
  return (
    <div className={cn('card divide-hairline overflow-hidden', className)}>
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} hideProject={hideProject} compact={compact} />
      ))}
    </div>
  )
}

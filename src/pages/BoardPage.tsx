import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Filter, Flag, ListTree, Plus, Timer, X } from 'lucide-react'
import { formatDuration } from '@/lib/date'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { labelsForTask } from '@/store/selectors'
import { useUI } from '@/store/ui'
import {
  PRIORITY_COLOR,
  STATUS_LABEL,
  TASK_STATUSES,
  type Task,
  type TaskStatus,
} from '@/types'
import { Page } from '@/components/layout/AppShell'
import { DueChip, LabelChips } from '@/components/task/pickers'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/controls'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import { Icon } from '@/components/ui/misc'

/* ------------------------------------------------------------------ card -- */

function Card({ task, overlay }: { task: Task; overlay?: boolean }) {
  const openTask = useUI((s) => s.openTask)
  const toggleTask = useData((s) => s.toggleTask)
  const projects = useData((s) => s.projects)
  const labels = useData((s) => s.labels)
  const taskLabels = useData((s) => s.task_labels)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
    disabled: overlay,
  })

  const project = projects.find((p) => p.id === task.project_id)
  const myLabels = useMemo(
    () => labelsForTask(task.id, labels, taskLabels),
    [task.id, labels, taskLabels],
  )
  const done = task.status === 'done'
  const subDone = task.subtasks.filter((s) => s.done).length

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        'group touch-none rounded-[var(--radius-md)] border border-border bg-surface p-2.5 transition-shadow',
        'cursor-grab active:cursor-grabbing hover:border-border-strong',
        isDragging && 'opacity-30',
        overlay && 'rotate-2 cursor-grabbing shadow-2xl shadow-black/40',
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={done}
          onCheckedChange={() => void toggleTask(task.id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0"
          aria-label={`Complete ${task.title}`}
        />
        <button
          onClick={() => openTask(task.id)}
          onPointerDown={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex items-start gap-1.5">
            {task.priority < 4 && (
              <Flag
                className="mt-0.5 size-3 shrink-0"
                style={{ color: PRIORITY_COLOR[task.priority] }}
              />
            )}
            <span
              className={cn(
                'text-[13px] leading-snug',
                done ? 'text-faint line-through' : 'text-fg',
              )}
            >
              {task.title}
            </span>
          </span>
        </button>
      </div>

      {(task.due_date || project || myLabels.length > 0 || task.estimate_minutes || task.subtasks.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 pl-6">
          <DueChip due={done ? null : task.due_date} />
          {task.estimate_minutes != null && (
            <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted">
              <Timer className="size-3" />
              {formatDuration(task.estimate_minutes)}
            </span>
          )}
          {task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] tabular-nums text-muted">
              <ListTree className="size-3" />
              {subDone}/{task.subtasks.length}
            </span>
          )}
          <LabelChips labels={myLabels} />
          {project && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Icon name={project.icon} className="size-3" style={{ color: project.color }} />
              {project.name}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- column -- */

function Column({
  status,
  tasks,
  onAdd,
}: {
  status: TaskStatus
  tasks: Task[]
  onAdd: (status: TaskStatus) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex w-[17.5rem] shrink-0 flex-col md:w-auto md:min-w-0 md:flex-1">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className={cn(
            'size-1.5 rounded-full',
            status === 'inbox' && 'bg-faint',
            status === 'today' && 'bg-accent',
            status === 'doing' && 'bg-warn',
            status === 'done' && 'bg-success',
          )}
        />
        <h2 className="text-[12px] font-semibold">{STATUS_LABEL[status]}</h2>
        <span className="text-[11px] tabular-nums text-faint">{tasks.length}</span>
        <button
          onClick={() => onAdd(status)}
          className="ml-auto grid size-5 place-items-center rounded text-faint transition-colors hover:bg-elevated hover:text-fg"
          aria-label={`Add task to ${STATUS_LABEL[status]}`}
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 space-y-2 rounded-[var(--radius-lg)] border border-dashed p-2 transition-colors',
          'min-h-32 md:min-h-0',
          isOver ? 'border-accent/50 bg-accent-soft/30' : 'border-border bg-surface/30',
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <Card key={task.id} task={task} />
          ))}
        </SortableContext>
        {!tasks.length && (
          <p className="py-6 text-center text-[12px] text-faint">Drop tasks here</p>
        )}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- board -- */

export function BoardPage() {
  const tasks = useData((s) => s.tasks)
  const projects = useData((s) => s.projects)
  const labels = useData((s) => s.labels)
  const taskLabels = useData((s) => s.task_labels)
  const moveTask = useData((s) => s.moveTask)
  const createTask = useData((s) => s.createTask)

  const { filterProjectId, filterLabelId, showDone, setFilter, clearFilters } = useUI()
  const openTask = useUI((s) => s.openTask)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    // A small threshold keeps taps and scrolls working on touch screens.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const visible = useMemo(() => {
    let list = tasks
    if (filterProjectId) list = list.filter((t) => t.project_id === filterProjectId)
    if (filterLabelId) {
      const ids = new Set(
        taskLabels.filter((tl) => tl.label_id === filterLabelId).map((tl) => tl.task_id),
      )
      list = list.filter((t) => ids.has(t.id))
    }
    return list
  }, [tasks, filterProjectId, filterLabelId, taskLabels])

  const columns = useMemo(() => {
    const map = {} as Record<TaskStatus, Task[]>
    for (const status of TASK_STATUSES) {
      const inColumn = visible
        .filter((t) => t.status === status)
        .sort((a, b) => a.position - b.position)
      // Done grows without bound; showing the last handful keeps it useful.
      map[status] = status === 'done' && !showDone ? inColumn.slice(-12) : inColumn
    }
    return map
  }, [visible, showDone])

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null
  const filtersOn = Boolean(filterProjectId || filterLabelId)

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const taskId = String(active.id)
    const overId = String(over.id)

    // `over` is either a column (dropped on empty space) or another card.
    const targetStatus = (TASK_STATUSES as string[]).includes(overId)
      ? (overId as TaskStatus)
      : ((over.data.current?.status as TaskStatus | undefined) ??
        tasks.find((t) => t.id === overId)?.status)
    if (!targetStatus) return

    const column = columns[targetStatus].filter((t) => t.id !== taskId)
    const index = (TASK_STATUSES as string[]).includes(overId)
      ? column.length
      : Math.max(0, column.findIndex((t) => t.id === overId))

    const current = tasks.find((t) => t.id === taskId)
    if (current?.status === targetStatus && current.position === column[index]?.position) return

    void moveTask(taskId, targetStatus, index)
  }

  const addTo = async (status: TaskStatus) => {
    const task = await createTask({
      title: 'New task',
      status,
      project_id: filterProjectId,
    })
    if (task) openTask(task.id)
  }

  return (
    <Page
      wide
      title="Board"
      subtitle="Drag between columns. Done tasks fall off the bottom."
      actions={
        <>
          {filtersOn && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="size-3.5" />
              Clear
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Filter className="size-3.5" />
                Filter
                {filtersOn && <span className="size-1.5 rounded-full bg-accent" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 w-52 overflow-y-auto">
              <DropdownMenuLabel>Project</DropdownMenuLabel>
              {projects
                .filter((p) => !p.archived)
                .map((p) => (
                  <DropdownMenuCheckboxItem
                    key={p.id}
                    checked={filterProjectId === p.id}
                    onCheckedChange={(checked) =>
                      setFilter({ filterProjectId: checked ? p.id : null })
                    }
                  >
                    <Icon name={p.icon} className="size-4" style={{ color: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </DropdownMenuCheckboxItem>
                ))}

              {labels.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Label</DropdownMenuLabel>
                  {labels.map((l) => (
                    <DropdownMenuCheckboxItem
                      key={l.id}
                      checked={filterLabelId === l.id}
                      onCheckedChange={(checked) =>
                        setFilter({ filterLabelId: checked ? l.id : null })
                      }
                    >
                      <span className="size-2 rounded-full" style={{ background: l.color }} />
                      {l.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={showDone}
                onCheckedChange={(checked) => setFilter({ showDone: Boolean(checked) })}
              >
                Show all done
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {/* Horizontal scroll on phones, four equal columns from md up. */}
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
          {TASK_STATUSES.map((status) => (
            <Column key={status} status={status} tasks={columns[status]} onAdd={addTo} />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.22,1,0.36,1)' }}>
          {activeTask ? <Card task={activeTask} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </Page>
  )
}

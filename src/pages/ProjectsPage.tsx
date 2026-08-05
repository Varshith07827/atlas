import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Archive,
  ArrowLeft,
  FileText,
  Lock,
  MoreHorizontal,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useData } from '@/store/data'
import { projectStats, sortByPosition, tasksForProject } from '@/store/selectors'
import { useUI } from '@/store/ui'
import { Page } from '@/components/layout/AppShell'
import { InlineCapture } from '@/components/QuickAdd'
import { TaskList } from '@/components/task/TaskItem'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/ui/field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/menu'
import { ConfirmDialog } from '@/components/ui/overlay'
import { EmptyState, Icon, SectionTitle } from '@/components/ui/misc'

const PALETTE = [
  'oklch(65% 0.16 258)',
  'oklch(68% 0.15 150)',
  'oklch(70% 0.17 40)',
  'oklch(68% 0.16 300)',
  'oklch(70% 0.14 200)',
  'oklch(66% 0.18 20)',
  'oklch(72% 0.15 90)',
  'oklch(62% 0.02 260)',
]

const ICONS = [
  'Folder',
  'GraduationCap',
  'House',
  'Dumbbell',
  'Rocket',
  'Plane',
  'Briefcase',
  'Heart',
  'Code',
  'Palette',
  'Music',
  'ShoppingCart',
]

/** Colour + icon picker, shared by the list and detail views. */
function Appearance({
  color,
  icon,
  onChange,
  children,
}: {
  color: string
  icon: string | null
  onChange: (patch: { color?: string; icon?: string }) => void
  children: React.ReactNode
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Colour</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ color: c })}
              className={cn(
                'size-6 rounded-full transition-transform hover:scale-110',
                color === c && 'ring-2 ring-fg ring-offset-2 ring-offset-elevated',
              )}
              style={{ background: c }}
              aria-label={`Colour ${c}`}
            />
          ))}
        </div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">Icon</p>
        <div className="grid grid-cols-6 gap-1">
          {ICONS.map((name) => (
            <button
              key={name}
              onClick={() => onChange({ icon: name })}
              className={cn(
                'grid size-7 place-items-center rounded-[var(--radius-sm)] transition-colors hover:bg-surface',
                icon === name && 'bg-surface',
              )}
              aria-label={name}
            >
              <Icon name={name} className="size-4" style={{ color }} />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------------------------------------------ list -- */

export function ProjectsPage() {
  const projects = useData((s) => s.projects)
  const tasks = useData((s) => s.tasks)
  const createProject = useData((s) => s.createProject)
  const navigate = useNavigate()
  const [showArchived, setShowArchived] = useState(false)

  const live = useMemo(
    () => sortByPosition(projects.filter((p) => p.archived === showArchived)),
    [projects, showArchived],
  )

  return (
    <Page
      title="Projects"
      subtitle="A project is anything with more than one step."
      actions={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
            className={cn(showArchived && 'text-fg')}
          >
            <Archive className="size-3.5" />
            {showArchived ? 'Active' : 'Archived'}
          </Button>
          <Button
            size="sm"
            variant="accent"
            onClick={async () => {
              const p = await createProject({ name: 'New project' })
              if (p) navigate(`/projects/${p.id}`)
            }}
          >
            <Plus className="size-3.5" />
            New
          </Button>
        </>
      }
    >
      {live.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {live.map((p) => {
            const s = projectStats(p.id, tasks)
            return (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="card group p-4 transition-colors hover:border-border-strong"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-md)]"
                    style={{ background: `color-mix(in oklab, ${p.color} 16%, transparent)` }}
                  >
                    <Icon name={p.icon} className="size-4" style={{ color: p.color }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[14px] font-medium">
                      {p.name}
                      {p.is_private && <Lock className="size-3 shrink-0 text-faint" />}
                    </p>
                    <p className="text-[12px] text-muted">
                      {s.total ? `${s.open} open · ${s.done} done` : 'No tasks yet'}
                    </p>
                  </div>
                </div>
                {s.total > 0 && (
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-elevated">
                    <div
                      className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quint)]"
                      style={{ width: `${s.ratio * 100}%`, background: p.color }}
                    />
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon="Folder"
            title={showArchived ? 'Nothing archived' : 'No projects yet'}
            description={
              showArchived
                ? 'Archived projects keep their tasks and notes, out of the way.'
                : 'Group related tasks and notes — College, Fitness, a trip, a side project.'
            }
            action={
              !showArchived && (
                <Button
                  size="sm"
                  variant="accent"
                  onClick={async () => {
                    const p = await createProject({ name: 'New project' })
                    if (p) navigate(`/projects/${p.id}`)
                  }}
                >
                  <Plus className="size-3.5" />
                  Create a project
                </Button>
              )
            }
          />
        </div>
      )}
    </Page>
  )
}

/* ---------------------------------------------------------------- detail -- */

export function ProjectDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const project = useData((s) => s.projects.find((p) => p.id === id) ?? null)
  const tasks = useData((s) => s.tasks)
  const notes = useData((s) => s.notes)
  const members = useData((s) => s.members)
  const updateProject = useData((s) => s.updateProject)
  const deleteProject = useData((s) => s.deleteProject)
  const createNote = useData((s) => s.createNote)
  const openTask = useUI((s) => s.openTask)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')

  const projectTasks = useMemo(() => tasksForProject(tasks, id), [tasks, id])
  const projectNotes = useMemo(
    () => notes.filter((n) => n.project_id === id),
    [notes, id],
  )

  // Re-sync the local drafts when navigating between projects.
  useEffect(() => {
    setName(project?.name ?? '')
    setDescription(project?.description ?? '')
  }, [project?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) {
    return (
      <Page>
        <EmptyState
          icon="FolderX"
          title="Project not found"
          description="It may have been deleted."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/projects')}>
              Back to projects
            </Button>
          }
        />
      </Page>
    )
  }

  const open = projectTasks.filter((t) => t.status !== 'done')
  const done = projectTasks.filter((t) => t.status === 'done')
  const stats = projectStats(id, tasks)

  return (
    <Page
      title={
        <span className="flex items-center gap-2.5">
          <Appearance
            color={project.color}
            icon={project.icon}
            onChange={(patch) => void updateProject(id, patch)}
          >
            <button
              className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] transition-transform hover:scale-105"
              style={{ background: `color-mix(in oklab, ${project.color} 16%, transparent)` }}
              aria-label="Change appearance"
            >
              <Icon name={project.icon} className="size-4" style={{ color: project.color }} />
            </button>
          </Appearance>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const next = name.trim()
              if (next && next !== project.name) void updateProject(id, { name: next })
              else setName(project.name)
            }}
            className="min-w-0 flex-1 bg-transparent text-[22px] font-semibold tracking-[-0.02em] focus:outline-none md:text-[26px]"
            aria-label="Project name"
          />
        </span>
      }
      subtitle={stats.total ? `${stats.open} open · ${stats.done} done` : 'No tasks yet'}
      actions={
        <>
          <Button variant="ghost" size="icon" onClick={() => navigate('/projects')} aria-label="Back">
            <ArrowLeft className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Project options">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => void updateProject(id, { is_private: !project.is_private })}
              >
                <Lock className="size-4" />
                {project.is_private ? 'Make shared' : 'Make private'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => void updateProject(id, { archived: !project.archived })}
              >
                <Archive className="size-4" />
                {project.archived ? 'Unarchive' : 'Archive'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" />
                Delete project
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      }
    >
      <div className="space-y-6">
        <Field>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              const next = description.trim()
              if (next !== (project.description ?? '')) {
                void updateProject(id, { description: next || null })
              }
            }}
            placeholder="What is this project about?"
            rows={2}
            className="border-0 bg-transparent px-0 text-[13px] text-muted focus:ring-0"
          />
        </Field>

        <section>
          <SectionTitle count={open.length}>Tasks</SectionTitle>
          <div className="space-y-3">
            <InlineCapture projectId={id} placeholder={`Add to ${project.name}…`} />
            {open.length ? (
              <TaskList tasks={open} hideProject />
            ) : (
              <div className="card">
                <EmptyState
                  icon="ListChecks"
                  title="No open tasks"
                  description="Add the next concrete step above."
                />
              </div>
            )}
          </div>
        </section>

        {done.length > 0 && (
          <section>
            <SectionTitle count={done.length}>Done</SectionTitle>
            <TaskList tasks={done.slice(-10)} hideProject compact />
          </section>
        )}

        <section>
          <SectionTitle
            count={projectNotes.length}
            action={
              <button
                onClick={async () => {
                  const note = await createNote({ project_id: id, title: 'Untitled' })
                  if (note) navigate(`/notes/${note.id}`)
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-faint transition-colors hover:text-fg"
              >
                <Plus className="size-3" />
                New note
              </button>
            }
          >
            Notes
          </SectionTitle>
          {projectNotes.length ? (
            <div className="card divide-hairline overflow-hidden">
              {projectNotes.map((n) => (
                <Link
                  key={n.id}
                  to={`/notes/${n.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-elevated/60"
                >
                  <FileText className="size-3.5 shrink-0 text-faint" />
                  <span className="truncate text-[13px]">{n.title}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-faint">No notes yet.</p>
          )}
        </section>

        {members.length > 1 && (
          <section>
            <SectionTitle>Members</SectionTitle>
            <p className="text-[13px] text-muted">
              Everyone in the workspace can see this project unless it's marked private.
            </p>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${project.name}"?`}
        description="Its tasks and notes are kept, but they'll no longer belong to a project."
        onConfirm={() => {
          navigate('/projects')
          void deleteProject(id)
          openTask(null)
        }}
      />
    </Page>
  )
}

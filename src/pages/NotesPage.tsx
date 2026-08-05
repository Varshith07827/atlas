import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  Eye,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { formatRelative } from '@/lib/date'
import { cn, debounce, fuzzyMatch } from '@/lib/utils'
import { useData } from '@/store/data'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { AutoTextarea, Input } from '@/components/ui/field'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu'
import { ConfirmDialog } from '@/components/ui/overlay'
import { EmptyState, Icon } from '@/components/ui/misc'

/** First non-heading line, used as the card preview. */
function preview(content: string): string {
  const line = content
    .split('\n')
    .map((l) => l.replace(/^[#>\-*\s]+/, '').trim())
    .find(Boolean)
  return line ?? 'Empty note'
}

/* ------------------------------------------------------------------ list -- */

export function NotesPage() {
  const notes = useData((s) => s.notes)
  const projects = useData((s) => s.projects)
  const createNote = useData((s) => s.createNote)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const filtered = query
      ? notes.filter((n) => fuzzyMatch(n.title, query) || fuzzyMatch(n.content, query))
      : notes
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.updated_at.localeCompare(a.updated_at)
    })
  }, [notes, query])

  return (
    <Page
      title="Notes"
      subtitle="Markdown, checklists, whatever needs writing down."
      actions={
        <Button
          size="sm"
          variant="accent"
          onClick={async () => {
            const note = await createNote()
            if (note) navigate(`/notes/${note.id}`)
          }}
        >
          <Plus className="size-3.5" />
          New
        </Button>
      }
    >
      <div className="space-y-4">
        {notes.length > 4 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter notes…"
              className="pl-9"
            />
          </div>
        )}

        {visible.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((n) => {
              const project = projects.find((p) => p.id === n.project_id)
              return (
                <Link
                  key={n.id}
                  to={`/notes/${n.id}`}
                  className="card group flex flex-col p-4 transition-colors hover:border-border-strong"
                >
                  <p className="flex items-center gap-1.5 text-[14px] font-medium">
                    {n.pinned && <Pin className="size-3 shrink-0 text-warn" />}
                    <span className="truncate">{n.title}</span>
                    {n.is_private && <Lock className="size-3 shrink-0 text-faint" />}
                  </p>
                  <p className="mt-1.5 line-clamp-3 flex-1 text-[12px] leading-relaxed text-muted">
                    {preview(n.content)}
                  </p>
                  <p className="mt-3 flex items-center gap-2 text-[11px] text-faint">
                    {project && (
                      <span className="inline-flex items-center gap-1">
                        <Icon
                          name={project.icon}
                          className="size-2.5"
                          style={{ color: project.color }}
                        />
                        {project.name}
                      </span>
                    )}
                    <span className="ml-auto">{formatRelative(n.updated_at)}</span>
                  </p>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="card">
            <EmptyState
              icon="FileText"
              title={query ? 'Nothing matches' : 'No notes yet'}
              description={
                query
                  ? 'Try a different word.'
                  : 'Lecture notes, meeting notes, half-formed ideas — anything that outlives a task.'
              }
              action={
                !query && (
                  <Button
                    size="sm"
                    variant="accent"
                    onClick={async () => {
                      const note = await createNote()
                      if (note) navigate(`/notes/${note.id}`)
                    }}
                  >
                    <Plus className="size-3.5" />
                    Write a note
                  </Button>
                )
              }
            />
          </div>
        )}
      </div>
    </Page>
  )
}

/* ---------------------------------------------------------------- editor -- */

export function NoteDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const note = useData((s) => s.notes.find((n) => n.id === id) ?? null)
  const projects = useData((s) => s.projects)
  const updateNote = useData((s) => s.updateNote)
  const deleteNote = useData((s) => s.deleteNote)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [mode, setMode] = useState<'write' | 'read'>('write')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Autosave: one write per pause in typing, not one per keystroke.
  const save = useRef(
    debounce((noteId: string, patch: { title?: string; content?: string }) => {
      void useData.getState().updateNote(noteId, patch)
    }, 600),
  ).current

  useEffect(() => {
    setTitle(note?.title ?? '')
    setContent(note?.content ?? '')
    setMode(note?.content ? 'read' : 'write')
  }, [note?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Don't leave the last few keystrokes unsaved when navigating away.
  useEffect(() => () => save.cancel(), [save])

  if (!note) {
    return (
      <Page>
        <EmptyState
          icon="FileX"
          title="Note not found"
          description="It may have been deleted."
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/notes')}>
              Back to notes
            </Button>
          }
        />
      </Page>
    )
  }

  const project = projects.find((p) => p.id === note.project_id)

  return (
    <Page>
      <div className="mb-4 flex items-center gap-1.5">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/notes')} aria-label="Back">
          <ArrowLeft className="size-4" />
        </Button>
        {project && (
          <Link
            to={`/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted transition-colors hover:text-fg"
          >
            <Icon name={project.icon} className="size-2.5" style={{ color: project.color }} />
            {project.name}
          </Link>
        )}
        <span className="ml-auto text-[11px] text-faint">{formatRelative(note.updated_at)}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setMode(mode === 'write' ? 'read' : 'write')}
          aria-label={mode === 'write' ? 'Preview' : 'Edit'}
        >
          {mode === 'write' ? <Eye className="size-4" /> : <Pencil className="size-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Note options">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void updateNote(id, { pinned: !note.pinned })}>
              <Pin className="size-4" />
              {note.pinned ? 'Unpin' : 'Pin to top'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => void updateNote(id, { is_private: !note.is_private })}
            >
              <Lock className="size-4" />
              {note.is_private ? 'Make shared' : 'Make private'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" />
              Delete note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          save(id, { title: e.target.value.trim() || 'Untitled' })
        }}
        placeholder="Title"
        className="w-full bg-transparent text-[24px] font-semibold tracking-[-0.02em] placeholder:text-faint focus:outline-none"
        aria-label="Note title"
      />

      <div className="mt-4">
        {mode === 'write' ? (
          <AutoTextarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              save(id, { content: e.target.value })
            }}
            placeholder={'Write in Markdown…\n\n# Heading\n- [ ] a checklist item\n**bold**, *italic*, `code`'}
            minRows={14}
            className="border-0 bg-transparent px-0 font-mono text-[13px] leading-[1.75] focus:ring-0"
            aria-label="Note content"
          />
        ) : (
          <article
            onClick={() => setMode('write')}
            className={cn(
              'prose-atlas min-h-64 cursor-text text-[14px] leading-relaxed',
              !content && 'text-faint',
            )}
          >
            {content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            ) : (
              'Nothing written yet — click to start.'
            )}
          </article>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${note.title}"?`}
        description="This can't be undone."
        onConfirm={() => {
          navigate('/notes')
          void deleteNote(id)
        }}
      />
    </Page>
  )
}

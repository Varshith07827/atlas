import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUI } from '@/store/ui'

/** True when the keystroke belongs to whatever the user is typing into. */
function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  )
}

export const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '⌘K', label: 'Search everything' },
  { keys: 'C', label: 'Capture to Inbox' },
  { keys: 'G then D', label: 'Dashboard' },
  { keys: 'G then I', label: 'Inbox' },
  { keys: 'G then B', label: 'Board' },
  { keys: 'G then C', label: 'Calendar' },
  { keys: 'G then P', label: 'Projects' },
  { keys: 'G then N', label: 'Notes' },
  { keys: 'G then H', label: 'Habits' },
  { keys: '?', label: 'This list' },
  { keys: 'Esc', label: 'Close' },
]

const GO_TO: Record<string, string> = {
  d: '/',
  i: '/inbox',
  b: '/board',
  c: '/calendar',
  p: '/projects',
  n: '/notes',
  h: '/habits',
  s: '/settings',
}

/**
 * Global keyboard shortcuts, Linear-style: single letters when you aren't
 * typing, plus a `g`-prefixed jump sequence.
 */
export function useShortcuts(onShowHelp: () => void) {
  const navigate = useNavigate()
  const { setPaletteOpen, setQuickAddOpen } = useUI()

  useEffect(() => {
    let awaitingGoTo = false
    let goToTimer: ReturnType<typeof setTimeout> | undefined

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      if (isTypingTarget(e.target) || e.altKey) return

      if (awaitingGoTo) {
        const target = GO_TO[e.key.toLowerCase()]
        awaitingGoTo = false
        clearTimeout(goToTimer)
        if (target) {
          e.preventDefault()
          navigate(target)
        }
        return
      }

      if (mod) return

      switch (e.key.toLowerCase()) {
        case 'g':
          awaitingGoTo = true
          // A stale prefix is worse than no prefix; forget it after a moment.
          goToTimer = setTimeout(() => (awaitingGoTo = false), 1200)
          break
        case 'c':
          e.preventDefault()
          setQuickAddOpen(true)
          break
        case '/':
          e.preventDefault()
          setPaletteOpen(true)
          break
        case '?':
          e.preventDefault()
          onShowHelp()
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      clearTimeout(goToTimer)
    }
  }, [navigate, onShowHelp, setPaletteOpen, setQuickAddOpen])
}

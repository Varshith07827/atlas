import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** UUID v4. `crypto.randomUUID` needs a secure context; fall back for http://LAN. */
export function uid(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const b = new Uint8Array(16)
  c.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const nowISO = () => new Date().toISOString()

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Debounce that keeps the latest args and returns a cancel handle. */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  const wrapped = (...a: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...a), ms)
  }
  wrapped.cancel = () => {
    if (t) clearTimeout(t)
  }
  wrapped.flush = (...a: A) => {
    if (t) clearTimeout(t)
    fn(...a)
  }
  return wrapped
}

/**
 * Fractional indexing for drag-and-drop ordering: dropping between two cards
 * rewrites one row instead of renumbering the whole column.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before == null && after == null) return 1000
  if (before == null) return after! - 1000
  if (after == null) return before + 1000
  return (before + after) / 2
}

export function groupBy<T, K extends string>(items: T[], key: (t: T) => K) {
  const out = {} as Record<K, T[]>
  for (const item of items) {
    const k = key(item)
    ;(out[k] ??= []).push(item)
  }
  return out
}

export function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]))
}

/** Case/diacritic-insensitive substring match, for search and filters. */
export function fuzzyMatch(haystack: string, needle: string): boolean {
  if (!needle) return true
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  return norm(haystack).includes(norm(needle))
}

/** Score for ranking search hits: prefix > word-start > contains. */
export function matchScore(haystack: string, needle: string): number {
  if (!needle) return 0
  const h = haystack.toLowerCase()
  const n = needle.toLowerCase()
  const i = h.indexOf(n)
  if (i === -1) return -1
  if (i === 0) return 100
  if (h[i - 1] === ' ') return 60
  return 20
}

export function initials(name: string | null | undefined, email?: string): string {
  const source = name?.trim() || email?.split('@')[0] || '?'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

/** Deterministic colour from a string, so avatars stay stable across reloads. */
export function stringToHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

export function isTouchDevice() {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

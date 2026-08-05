import { create } from 'zustand'
import type { ThemeMode } from '@/types'

const THEME_KEY = 'atlas.theme'

interface UIState {
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void

  paletteOpen: boolean
  setPaletteOpen: (open: boolean) => void

  quickAddOpen: boolean
  setQuickAddOpen: (open: boolean) => void

  /** Task id currently open in the detail sheet, or null. */
  openTaskId: string | null
  openTask: (id: string | null) => void

  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  /** Board and list filters, shared so they survive navigation. */
  filterProjectId: string | null
  filterLabelId: string | null
  showDone: boolean
  setFilter: (patch: Partial<Pick<UIState, 'filterProjectId' | 'filterLabelId' | 'showDone'>>) => void
  clearFilters: () => void
}

function readTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'system' || stored === 'dark' ? stored : 'dark'
}

/** Single place that touches the `dark` class, so theme changes can't drift. */
export function applyTheme(theme: ThemeMode) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0a0a0b' : '#ffffff')
  localStorage.setItem(THEME_KEY, theme)
}

export const useUI = create<UIState>((set, get) => ({
  theme: readTheme(),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },

  paletteOpen: false,
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),

  quickAddOpen: false,
  setQuickAddOpen: (quickAddOpen) => set({ quickAddOpen }),

  openTaskId: null,
  openTask: (openTaskId) => set({ openTaskId }),

  sidebarOpen: false,
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

  filterProjectId: null,
  filterLabelId: null,
  showDone: false,
  setFilter: (patch) => set(patch),
  clearFilters: () => set({ filterProjectId: null, filterLabelId: null, showDone: false }),
}))

// Follow the OS when the user picked "system".
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useUI.getState().theme === 'system') applyTheme('system')
  })
}

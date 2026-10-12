/**
 * Light and dark themes. The user's choice is stored; until they choose,
 * the operating system's setting is followed, live.
 *
 * The resolved theme is written to `<html data-theme>`, which the CSS
 * tokens key on. index.html runs the same resolution inline before the
 * first paint, so a dark-theme user never sees a white flash.
 */
import { useCallback, useSyncExternalStore } from 'react'

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

export const STORAGE_KEY = 'theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const listeners = new Set<() => void>()

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system' // storage blocked (private mode, sandboxed frames)
  }
}

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): Theme {
  return preference === 'system' ? systemTheme() : preference
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Not persisted; the choice still applies for this page.
  }
  applyTheme(resolveTheme(preference))
  listeners.forEach((notify) => {
    notify()
  })
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify)
  const media = window.matchMedia(DARK_QUERY)
  const onSystemChange = () => {
    if (readPreference() === 'system') applyTheme(systemTheme())
    notify()
  }
  media.addEventListener('change', onSystemChange)
  return () => {
    listeners.delete(notify)
    media.removeEventListener('change', onSystemChange)
  }
}

function snapshot(): string {
  const preference = readPreference()
  return `${preference}:${resolveTheme(preference)}`
}

export function useTheme(): {
  preference: ThemePreference
  theme: Theme
  setPreference: (preference: ThemePreference) => void
} {
  const value = useSyncExternalStore(subscribe, snapshot)
  const [preference, theme] = value.split(':') as [ThemePreference, Theme]
  const setPreference = useCallback((next: ThemePreference) => {
    setThemePreference(next)
  }, [])
  return { preference, theme, setPreference }
}

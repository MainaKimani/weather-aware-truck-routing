/**
 * Short messages after something happened elsewhere on the page, such as
 * "3 trips were added to your account". Shown by <Toaster>, which a screen
 * reader announces.
 *
 * Most go along the bottom and leave after a few seconds. A status that
 * lasts as long as some work, such as the heatmap being generated, goes top
 * right with no time limit, and whoever showed it dismisses it when the work
 * ends (the user can close it sooner).
 */
import { create } from 'zustand'

export type ToastPlacement = 'bottom' | 'top-right'

export interface Toast {
  id: number
  message: string
  placement: ToastPlacement
  /** Milliseconds on screen; null stays until dismissed. */
  durationMs: number | null
}

/** How long a message stays by default: long enough to read twice. */
export const TOAST_MS = 6000

interface ShowOptions {
  placement?: ToastPlacement
  durationMs?: number | null
}

interface ToastState {
  toasts: readonly Toast[]
  /** Shows a message and returns its id, for dismissing it later. */
  show: (message: string, options?: ShowOptions) => number
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (message, { placement = 'bottom', durationMs = TOAST_MS } = {}) => {
    const toast = { id: nextId++, message, placement, durationMs }
    set((s) => ({ toasts: [...s.toasts, toast] }))
    return toast.id
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export function resetToastStore(): void {
  useToastStore.setState({ toasts: [] })
}

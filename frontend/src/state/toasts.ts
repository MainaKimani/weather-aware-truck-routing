/**
 * Short messages after something happened elsewhere on the page, such as
 * "3 trips were added to your account". Shown by <Toaster>, which a screen
 * reader announces.
 */
import { create } from 'zustand'

export interface Toast {
  id: number
  message: string
}

interface ToastState {
  toasts: readonly Toast[]
  show: (message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (message) => {
    const toast = { id: nextId++, message }
    set((s) => ({ toasts: [...s.toasts, toast] }))
  },
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export function resetToastStore(): void {
  useToastStore.setState({ toasts: [] })
}

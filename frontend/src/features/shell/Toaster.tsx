import { useEffect } from 'react'

import { useToastStore, type Toast } from '../../state/toasts'

/** How long a message stays: long enough to read twice. */
export const TOAST_MS = 6000

/** Messages along the bottom of the window, announced politely, each with a close button. */
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss(toast.id)
    }, TOAST_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [toast.id, dismiss])
  return (
    <div className="pointer-events-auto flex max-w-md items-start gap-3 rounded-card border border-line bg-surface px-3 py-2 text-sm shadow-overlay">
      <p>{toast.message}</p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          dismiss(toast.id)
        }}
        className="-my-0.5 shrink-0 rounded px-1 text-muted hover:text-ink"
      >
        ×
      </button>
    </div>
  )
}

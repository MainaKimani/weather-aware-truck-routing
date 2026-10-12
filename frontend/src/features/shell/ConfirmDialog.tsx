/**
 * Asks before something that can't be undone, such as deleting a trip. An
 * alertdialog: focus starts on Cancel, the safe choice, stays inside while
 * it is open, Escape cancels, and focus returns where it was afterwards.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  /** While the action runs: both buttons wait. */
  busy?: boolean
  /** Shown under the text, such as why the action failed. */
  error?: string | null
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  error = null,
}: ConfirmDialogProps) {
  const ids = { title: useId(), body: useId() }
  const dialog = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null
    cancel.current?.focus()
    return () => {
      returnTo?.focus()
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (!busy) onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last?.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first?.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div
        ref={dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={ids.title}
        aria-describedby={ids.body}
        onKeyDown={onKeyDown}
        className="w-full max-w-sm rounded-card border border-line bg-surface p-4 shadow-overlay"
      >
        <h2 id={ids.title} className="font-semibold">
          {title}
        </h2>
        <div id={ids.body} className="mt-2 text-sm text-muted">
          {children}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancel}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-raised disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            className="rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-surface hover:opacity-90 disabled:opacity-60"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

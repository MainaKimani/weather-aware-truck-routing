/** Asks before something that can't be undone, such as deleting a trip; Cancel has focus. */
import { useRef, type ReactNode } from 'react'

import { Modal } from './Modal'

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
  const cancel = useRef<HTMLButtonElement>(null)
  return (
    <Modal
      title={title}
      role="alertdialog"
      onClose={onCancel}
      busy={busy}
      initialFocus={cancel}
      description={children}
    >
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
    </Modal>
  )
}

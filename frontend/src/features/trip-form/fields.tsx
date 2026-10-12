/** Small field pieces shared by the trip form's inputs. */
import type { ReactNode } from 'react'

export const inputClass =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted aria-invalid:border-danger'

interface FieldErrorProps {
  id: string
  message?: string
  /** Announce it as it appears (for errors that arrive after submitting). */
  alert?: boolean
}

export function FieldError({ id, message, alert = false }: FieldErrorProps) {
  if (!message) return null
  return (
    <p id={id} role={alert ? 'alert' : undefined} className="mt-1 text-xs text-danger">
      {message}
    </p>
  )
}

export function Chip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-[11px] text-muted"
    >
      {children}
    </span>
  )
}

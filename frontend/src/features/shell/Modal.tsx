/**
 * A modal dialog: the page behind is dimmed, focus starts on `initialFocus`
 * (or the first button) and stays inside, Escape closes it, and focus goes
 * back where it was afterwards.
 */
import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  title: string
  /** `alertdialog` for something that can't be undone; `dialog` otherwise. */
  role?: 'dialog' | 'alertdialog'
  onClose: () => void
  /** While something runs, Escape waits. */
  busy?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  /** The text the dialog is about, read with its title. */
  description: ReactNode
  children: ReactNode
}

export function Modal({
  title,
  role = 'dialog',
  onClose,
  busy = false,
  initialFocus,
  description,
  children,
}: ModalProps) {
  const ids = { title: useId(), body: useId() }
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const returnTo = document.activeElement as HTMLElement | null
    const first = initialFocus?.current ?? box.current?.querySelector<HTMLElement>('a, button')
    first?.focus()
    return () => {
      returnTo?.focus()
    }
  }, [initialFocus])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      if (!busy) onClose()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = box.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
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
        ref={box}
        role={role}
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
          {description}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

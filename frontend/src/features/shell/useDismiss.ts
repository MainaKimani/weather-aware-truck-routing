import { useEffect, type RefObject } from 'react'

/** Closes an open popover on Escape (focus back on `trigger`) or a press outside `container`. */
export function useDismiss(
  open: boolean,
  container: RefObject<HTMLElement | null>,
  trigger: RefObject<HTMLElement | null>,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      trigger.current?.focus()
    }
    const onPointer = (e: PointerEvent) => {
      if (!container.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, container, trigger, close])
}

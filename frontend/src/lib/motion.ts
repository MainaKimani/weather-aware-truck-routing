/** True when the user asked the system for less motion; camera moves then jump instead of fly. */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

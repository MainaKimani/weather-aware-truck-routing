/**
 * jsdom has no matchMedia. This stand-in answers `(prefers-color-scheme: dark)`
 * and `(prefers-reduced-motion: reduce)` from flags that tests flip, and
 * notifies colour-scheme listeners like the real one.
 */
type Listener = (event: MediaQueryListEvent) => void

let dark = false
let reducedMotion = false
const listeners = new Set<Listener>()

export function setSystemDark(value: boolean): void {
  dark = value
  listeners.forEach((listener) => {
    listener({ matches: value } as MediaQueryListEvent)
  })
}

export function setReducedMotion(value: boolean): void {
  reducedMotion = value
}

window.matchMedia = (query: string): MediaQueryList =>
  ({
    get matches() {
      if (query.includes('reduced-motion')) return reducedMotion
      return query.includes('dark') ? dark : false
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList

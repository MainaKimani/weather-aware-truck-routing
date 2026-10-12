/**
 * jsdom has no matchMedia. This stand-in answers `(prefers-color-scheme: dark)`
 * from a flag that tests flip, and notifies listeners like the real one.
 */
type Listener = (event: MediaQueryListEvent) => void

let dark = false
const listeners = new Set<Listener>()

export function setSystemDark(value: boolean): void {
  dark = value
  listeners.forEach((listener) => {
    listener({ matches: value } as MediaQueryListEvent)
  })
}

window.matchMedia = (query: string): MediaQueryList =>
  ({
    get matches() {
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

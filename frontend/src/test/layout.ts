/**
 * jsdom does no layout, so every element is 0 px tall and a virtualised list
 * renders no rows. This gives an element with an inline max-height that
 * height, which is what a scroll container shows in a browser, and leaves
 * everything else at 0. Call it in tests of virtualised lists.
 */
import { afterEach, beforeEach } from 'vitest'

export function withScrollContainerLayout(): void {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get(this: HTMLElement) {
        return parseFloat(this.style.maxHeight) || 0
      },
    })
  })
  afterEach(() => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', original)
  })
}

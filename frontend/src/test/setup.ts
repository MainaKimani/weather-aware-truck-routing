import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest'

import { resetTimelineStore } from '../state/timeline'
import { resetToastStore } from '../state/toasts'
import { resetUiStore } from '../state/ui'
import { resetFakeMap } from './fakeMap'
import { setReducedMotion, setSystemDark } from './matchMedia'
import { server } from './server'

// jsdom has no WebGL; every test gets the stand-in map from fakeMap.ts.
vi.mock('react-map-gl/maplibre', async () => ({
  ...(await import('./fakeMapLibrary')),
  useMap: (await import('./fakeMap')).useMap,
}))

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

beforeEach(() => {
  localStorage.clear()
  setSystemDark(false)
  setReducedMotion(false)
  delete document.documentElement.dataset.theme
  resetUiStore()
  resetTimelineStore()
  resetToastStore()
  resetFakeMap()
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

afterAll(() => {
  server.close()
})

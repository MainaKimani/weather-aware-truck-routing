import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'

import { resetTimelineStore } from '../state/timeline'
import { resetUiStore } from '../state/ui'
import { setSystemDark } from './matchMedia'
import { server } from './server'

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

beforeEach(() => {
  localStorage.clear()
  setSystemDark(false)
  delete document.documentElement.dataset.theme
  resetUiStore()
  resetTimelineStore()
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  document.cookie = 'csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT'
})

afterAll(() => {
  server.close()
})

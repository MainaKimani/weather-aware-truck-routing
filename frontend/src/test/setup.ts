import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

import { setSystemDark } from './matchMedia'

beforeEach(() => {
  localStorage.clear()
  setSystemDark(false)
  delete document.documentElement.dataset.theme
})

afterEach(() => {
  cleanup()
})

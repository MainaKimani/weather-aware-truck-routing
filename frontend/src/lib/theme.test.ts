import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { setSystemDark } from '../test/matchMedia'
import { STORAGE_KEY, resolveTheme, setThemePreference, useTheme } from './theme'

const root = document.documentElement

describe('theme', () => {
  it('follows the system until the user chooses', () => {
    expect(resolveTheme('system')).toBe('light')
    setSystemDark(true)
    expect(resolveTheme('system')).toBe('dark')
  })

  it('stores an explicit choice and applies it to <html>', () => {
    setThemePreference('dark')

    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    expect(root.dataset.theme).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')
  })

  it('forgets the choice when set back to system', () => {
    setThemePreference('dark')
    setThemePreference('system')

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(root.dataset.theme).toBe('light')
  })

  it('re-renders on a system change while following the system', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current).toMatchObject({ preference: 'system', theme: 'light' })

    act(() => {
      setSystemDark(true)
    })

    expect(result.current.theme).toBe('dark')
    expect(root.dataset.theme).toBe('dark')
  })

  it('ignores system changes once the user has chosen', () => {
    const { result } = renderHook(() => useTheme())
    act(() => {
      result.current.setPreference('light')
    })
    act(() => {
      setSystemDark(true)
    })

    expect(result.current).toMatchObject({ preference: 'light', theme: 'light' })
    expect(root.dataset.theme).toBe('light')
  })

  it('still applies the theme when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })

    setThemePreference('dark')

    expect(root.dataset.theme).toBe('dark')
  })
})

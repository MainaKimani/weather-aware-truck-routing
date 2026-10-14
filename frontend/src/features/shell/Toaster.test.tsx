import { act, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { resetToastStore, TOAST_MS, useToastStore } from '../../state/toasts'
import { Toaster } from './Toaster'

afterEach(() => {
  vi.useRealTimers()
  resetToastStore()
})

describe('toaster', () => {
  it('times out ordinary messages but keeps an open-ended one until it is dismissed', () => {
    vi.useFakeTimers()
    render(<Toaster />)
    let working = 0
    act(() => {
      useToastStore.getState().show('Trip saved.')
      working = useToastStore.getState().show('Working on it.', {
        placement: 'top-right',
        durationMs: null,
      })
    })
    const regions = screen.getAllByRole('status')
    expect(regions).toHaveLength(2)
    const [bottom, topRight] = regions as [HTMLElement, HTMLElement]
    expect(within(bottom).getByText('Trip saved.')).toBeInTheDocument()
    expect(within(topRight).getByText('Working on it.')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(TOAST_MS * 3)
    })
    expect(screen.queryByText('Trip saved.')).toBeNull()
    expect(screen.getByText('Working on it.')).toBeInTheDocument()

    act(() => {
      useToastStore.getState().dismiss(working)
    })
    expect(screen.queryByText('Working on it.')).toBeNull()
  })
})

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { planKeys } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { AppProviders } from '../../app/AppProviders'
import { useTimelineStore } from '../../state/timeline'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { freshClient } from '../../test/render'
import { HourSlider, NO_TRIP_HINT, PLAY_STEP_MS } from './HourSlider'

function renderSlider(plan?: Plan) {
  const client = freshClient()
  if (plan) client.setQueryData(planKeys.current(), plan)
  render(
    <AppProviders queryClient={client}>
      <HourSlider />
    </AppProviders>,
  )
  return client
}

const slider = () => screen.getByRole('slider', { name: 'Forecast' })
const hour = () => useTimelineStore.getState().hour

afterEach(() => {
  vi.useRealTimers()
})

describe('forecast slider', () => {
  it('runs 0-48 with a tick every 6 hours', () => {
    renderSlider(demoPlan)

    expect(slider()).toHaveAttribute('min', '0')
    expect(slider()).toHaveAttribute('max', '48')
    const ticks = document.getElementById(slider().getAttribute('list') ?? '')
    expect([...(ticks?.querySelectorAll('option') ?? [])].map((o) => o.value)).toEqual([
      '0',
      '6',
      '12',
      '18',
      '24',
      '30',
      '36',
      '42',
      '48',
    ])
  })

  it("shows each hour's clock time from the heatmap's first hour, on the origin's clock", async () => {
    renderSlider(demoPlan)

    // The heatmap starts at 15:00 UTC: 10:00 in Dallas.
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('+0 h · Mon 10:00 CDT')
    })
    act(() => {
      useTimelineStore.getState().setHour(14)
    })
    expect(screen.getByRole('status')).toHaveTextContent('+14 h · Tue 00:00 CDT')
    expect(slider()).toHaveAttribute('aria-valuetext', '+14 hours, Tuesday 00:00')
  })

  it('counts from the hour after the plan until the heatmap arrives', () => {
    renderSlider(demoPlan)

    // Planned at 08:25 UTC; the next whole hour is 09:00 UTC, 04:00 in Dallas.
    expect(screen.getByRole('status')).toHaveTextContent('+0 h · Mon 04:00 CDT')
  })

  it('says nothing about the window when the trip leaves within it', () => {
    renderSlider(demoPlan)
    expect(screen.queryByText(/before this trip departs/)).not.toBeInTheDocument()
  })

  it('notes when the 48 hours end before the trip departs', () => {
    renderSlider({
      ...demoPlan,
      inputs: { ...demoPlan.inputs, departure: '2026-10-16T13:00:00Z' },
    })

    expect(
      screen.getByText(/The forecast runs to Wed 04:00 CDT, before this trip departs/),
    ).toBeInTheDocument()
  })
})

describe('playback', () => {
  it('steps one hour every 250 ms and pauses', () => {
    vi.useFakeTimers()
    renderSlider(demoPlan)

    fireEvent.click(screen.getByRole('button', { name: 'Play forecast' }))
    act(() => {
      vi.advanceTimersByTime(PLAY_STEP_MS * 3)
    })
    expect(hour()).toBe(3)

    fireEvent.click(screen.getByRole('button', { name: 'Pause forecast' }))
    act(() => {
      vi.advanceTimersByTime(PLAY_STEP_MS * 4)
    })
    expect(hour()).toBe(3)
    expect(screen.getByRole('button', { name: 'Play forecast' })).toBeInTheDocument()
  })

  it('loops back to the first hour after the last', () => {
    vi.useFakeTimers()
    act(() => {
      useTimelineStore.getState().setHour(47)
    })
    renderSlider(demoPlan)

    fireEvent.click(screen.getByRole('button', { name: 'Play forecast' }))
    act(() => {
      vi.advanceTimersByTime(PLAY_STEP_MS)
    })
    expect(hour()).toBe(48)
    act(() => {
      vi.advanceTimersByTime(PLAY_STEP_MS)
    })
    expect(hour()).toBe(0)
  })

  it('stops when the slider is moved by hand', () => {
    vi.useFakeTimers()
    renderSlider(demoPlan)
    fireEvent.click(screen.getByRole('button', { name: 'Play forecast' }))

    fireEvent.change(slider(), { target: { value: '30' } })
    act(() => {
      vi.advanceTimersByTime(PLAY_STEP_MS * 4)
    })

    expect(hour()).toBe(30)
    expect(useTimelineStore.getState().playing).toBe(false)
  })
})

describe('before a trip is planned', () => {
  const play = () => screen.getByRole('button', { name: 'Play forecast' })

  it('disables playback and the slider, and describes why', () => {
    renderSlider()

    expect(play()).toBeDisabled()
    expect(slider()).toBeDisabled()
    expect(play()).toHaveAccessibleDescription(NO_TRIP_HINT)
    expect(slider()).toHaveAccessibleDescription(NO_TRIP_HINT)
    // Shown on hover by CSS; it's in the page either way.
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(NO_TRIP_HINT)
  })

  it('enables both once a trip with routes is on screen', () => {
    renderSlider(demoPlan)

    expect(play()).toBeEnabled()
    expect(slider()).toBeEnabled()
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull()
  })
})

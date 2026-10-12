import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Plan } from '../../api/schema'
import { formatClockTime } from '../../lib/format'
import { useUiStore } from '../../state/ui'
import { at } from '../../test/at'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { strongHosPlan } from '../../test/fixtures/strongHosPlan'
import { renderMap } from '../../test/renderMap'

const plan: Plan = strongHosPlan
const zone = 'America/Chicago'
const stopsOf = (routeId: string) => {
  const route = plan.routes.find((r) => r.id === routeId)
  if (!route) throw new Error(`no route ${routeId} in the fixture`)
  return route.hos_stops
}
const stopButtons = () => screen.queryAllByRole('button', { name: /^(Break|Rest|Restart) / })

describe('HOS stops on the map', () => {
  it('marks each stop of the selected route at the coordinates the API gave', () => {
    renderMap(plan)

    const stops = stopsOf('r1')
    const buttons = stopButtons()
    expect(buttons).toHaveLength(stops.length)
    stops.forEach((stop, i) => {
      const marker = at(buttons, i).closest('[data-testid=marker]')
      expect(marker).toHaveAttribute('data-lnglat', `${String(stop.lon)},${String(stop.lat)}`)
    })
    expect(at(buttons, 0)).toHaveAccessibleName(
      `Break 30 min, ${formatClockTime(at(stops, 0).start, zone)}`,
    )
  })

  it('shows nothing when Hours of Service is off', () => {
    renderMap(demoPlan)

    expect(stopButtons()).toHaveLength(0)
  })

  it('opens a popup saying when the stop starts and ends, and why', async () => {
    renderMap(plan)
    const rest = at(stopsOf('r1'), 1)

    await userEvent.click(at(stopButtons(), 1))

    const popup = screen.getByRole('region', { name: 'Rest stop' })
    const end = new Date(Date.parse(rest.start) + rest.duration_s * 1000).toISOString()
    expect(popup).toHaveTextContent('Rest 10 h')
    expect(popup).toHaveTextContent(`Starts${formatClockTime(rest.start, zone)}`)
    expect(popup).toHaveTextContent(`Ends${formatClockTime(end, zone)}`)
    expect(popup).toHaveTextContent('Why11 h driving limit')
    expect(at(stopButtons(), 1)).toHaveAttribute('aria-expanded', 'true')

    await userEvent.click(
      within(screen.getByTestId('popup')).getByRole('button', { name: 'Close popup' }),
    )
    expect(screen.queryByRole('region', { name: 'Rest stop' })).not.toBeInTheDocument()
  })

  it('does not let a stop click reach the map as a click on empty map', async () => {
    renderMap(plan)
    act(() => {
      useUiStore.getState().selectCheckpoint({ routeId: 'r1', index: 2 })
    })

    await userEvent.click(at(stopButtons(), 0))

    expect(useUiStore.getState().selectedCheckpoint).toEqual({ routeId: 'r1', index: 2 })
  })

  it('follows the selected route and closes a popup from the previous one', async () => {
    renderMap(plan)
    await userEvent.click(at(stopButtons(), 0))

    act(() => {
      useUiStore.getState().selectRoute('r2')
    })

    expect(screen.queryByRole('region', { name: 'Break stop' })).not.toBeInTheDocument()
    const stop = at(stopsOf('r2'), 0)
    expect(at(stopButtons(), 0).closest('[data-testid=marker]')).toHaveAttribute(
      'data-lnglat',
      `${String(stop.lon)},${String(stop.lat)}`,
    )
  })
})

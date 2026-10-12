import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '../../app/AppProviders'
import { planKeys } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { formatClockTime } from '../../lib/format'
import { useUiStore } from '../../state/ui'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { strongHosPlan } from '../../test/fixtures/strongHosPlan'
import { at, required } from '../../test/at'
import { withScrollContainerLayout } from '../../test/layout'
import { freshClient } from '../../test/render'
import { CheckpointTable, ROW_HEIGHT } from './CheckpointTable'

function renderTable(plan: Plan, routeId = 'r1') {
  const client = freshClient()
  client.setQueryData(planKeys.current(), plan)
  useUiStore.getState().selectRoute(routeId)
  render(
    <AppProviders queryClient={client}>
      <CheckpointTable />
    </AppProviders>,
  )
}

const bodyRows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .filter((r) => r.hasAttribute('tabindex'))

const clone = (plan: Plan): Plan => structuredClone<Plan>(plan)

describe('checkpoint table', () => {
  withScrollContainerLayout()

  it('shows nothing until a route is selected', () => {
    const client = freshClient()
    client.setQueryData(planKeys.current(), demoPlan)
    render(
      <AppProviders queryClient={client}>
        <CheckpointTable />
      </AppProviders>,
    )

    expect(screen.queryByRole('table')).toBeNull()
  })

  it("lists the selected route's checkpoints with the API's values", () => {
    renderTable(demoPlan)
    const route = demoPlan.routes[0]
    const first = route.checkpoints[0]

    expect(screen.getByRole('heading', { name: 'Checkpoints · Route A' })).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(route.checkpoints.length)
    const cells = within(at(bodyRows(), 0)).getAllByRole('cell')
    expect(cells.map((c) => c.textContent)).toEqual([
      String(Math.round(first.mile)),
      formatClockTime(first.eta, 'America/Chicago', false),
      `${first.forecast.wind_mph.toFixed(0)} / ${first.forecast.gust_mph.toFixed(0)}`,
      first.forecast.rain_in_hr.toFixed(2),
      first.forecast.snow_in_hr.toFixed(1),
      'Lowgusts',
    ])
  })

  it('follows the selected route', () => {
    renderTable(demoPlan)

    act(() => {
      useUiStore.getState().selectRoute('r2')
    })

    expect(screen.getByRole('heading', { name: 'Checkpoints · Route B' })).toBeInTheDocument()
    expect(screen.getAllByText('Severe').length).toBeGreaterThan(0)
  })

  it('shows a missing forecast as No data and Unknown, never Low or blank', () => {
    const plan = clone(demoPlan)
    const cp = at(at(plan.routes, 0).checkpoints, 2)
    cp.forecast = null
    cp.risk = {
      ...cp.risk,
      level: null,
      driver: null,
      wind: null,
      wind_adjusted: null,
      rain: null,
      snow: null,
    }
    renderTable(plan)

    const cells = within(at(bodyRows(), 2)).getAllByRole('cell')
    expect(cells.slice(2).map((c) => c.textContent)).toEqual([
      'No data',
      'No data',
      'No data',
      'Unknown',
    ])
  })

  it('names the zone once in the heading, and on a row only where it changes', () => {
    const plan = clone(demoPlan)
    // Pretend the trip runs into the end of daylight saving time.
    at(at(plan.routes, 0).checkpoints, 3).eta = '2026-11-02T15:00:00Z'
    renderTable(plan)

    expect(screen.getByRole('columnheader', { name: 'ETA CDT' })).toBeInTheDocument()
    expect(within(at(bodyRows(), 3)).getByText('CST')).toBeInTheDocument()
    expect(within(at(bodyRows(), 2)).queryByText(/C[DS]T/)).toBeNull()
  })

  it('marks a level raised by the load rule', () => {
    const plan = clone(demoPlan)
    at(at(plan.routes, 0).checkpoints, 1).risk.load_rule = 'wind_35_44_over_40k'
    renderTable(plan)

    expect(
      within(at(bodyRows(), 1)).getByTitle('Raised by the load rule for heavy trucks'),
    ).toBeInTheDocument()
  })

  it('selects a checkpoint by click or keyboard', async () => {
    renderTable(strongHosPlan, 'r2')
    const rows = bodyRows()

    await userEvent.click(at(rows, 3))
    expect(useUiStore.getState().selectedCheckpoint).toEqual({ routeId: 'r2', index: 3 })
    expect(rows[3]).toHaveAttribute('aria-selected', 'true')

    at(rows, 5).focus()
    await userEvent.keyboard('{Enter}')
    expect(useUiStore.getState().selectedCheckpoint).toEqual({ routeId: 'r2', index: 5 })
    expect(rows[3]).toHaveAttribute('aria-selected', 'false')
  })

  it('renders only a window of a long route and keeps up when scrolled', () => {
    const plan = clone(demoPlan)
    const template = at(at(plan.routes, 0).checkpoints, 0)
    at(plan.routes, 0).checkpoints = Array.from({ length: 300 }, (_, i) => ({
      ...template,
      mile: i * 10,
      owned_mi: 10,
    }))
    renderTable(plan)

    expect(screen.getByRole('table')).toHaveAttribute('aria-rowcount', '301')
    expect(bodyRows().length).toBeLessThan(40)
    expect(bodyRows()[0]).toHaveAttribute('aria-rowindex', '2')

    const scroller = required(screen.getByRole('table').parentElement, 'scroll container')
    act(() => {
      scroller.scrollTop = 200 * ROW_HEIGHT
      fireEvent.scroll(scroller)
    })

    const indexes = bodyRows().map((r) => Number(r.getAttribute('aria-rowindex')))
    expect(bodyRows().length).toBeLessThan(40)
    expect(indexes).toContain(202)
    expect(indexes).not.toContain(2)
  })
})

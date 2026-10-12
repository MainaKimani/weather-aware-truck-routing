import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '../../app/AppProviders'
import { planKeys } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { formatAvgRisk, formatClockTime, formatDuration, formatMiles } from '../../lib/format'
import { riskStyle } from '../../lib/risk'
import { useUiStore } from '../../state/ui'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { strongHosPlan } from '../../test/fixtures/strongHosPlan'
import { freshClient } from '../../test/render'
import { RoutesPanel } from './RoutesPanel'

function renderPanel(plan: Plan) {
  const client = freshClient()
  client.setQueryData(planKeys.current(), plan)
  render(
    <AppProviders queryClient={client}>
      <RoutesPanel />
    </AppProviders>,
  )
}

const clone = (plan: Plan): Plan => structuredClone<Plan>(plan)

function routeNamed(plan: Plan, name: string) {
  const route = plan.routes.find((r) => r.name === name)
  if (!route) throw new Error(`no ${name} in the fixture`)
  return route
}
const card = (name: string) => screen.getByRole('listitem', { name: new RegExp(`^${name}`) })

describe('route cards', () => {
  it('list the routes best first, with the badge and reason on the recommended one', () => {
    renderPanel(demoPlan)

    const cards = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(cards.map((c) => c.getAttribute('aria-labelledby'))).toEqual(
      demoPlan.routes.map((r) => `route-${r.id}-title`),
    )
    const best = within(card(demoPlan.routes[0].name))
    expect(best.getByText('Recommended')).toBeInTheDocument()
    expect(screen.getAllByText('Recommended')).toHaveLength(1)
    expect(best.getByText(demoPlan.recommendation_reason)).toBeInTheDocument()
  })

  it('show exactly the numbers in the API response', () => {
    renderPanel(demoPlan)

    for (const route of demoPlan.routes) {
      const c = within(card(route.name))
      expect(c.getByText(formatMiles(route.distance_mi))).toBeInTheDocument()
      expect(c.getByText(formatDuration(route.duration_s))).toBeInTheDocument()
      expect(c.getByText(formatClockTime(route.arrival, 'America/Denver'))).toBeInTheDocument()
      expect(c.getByText(formatAvgRisk(route.metrics.avg_risk))).toBeInTheDocument()
      expect(c.getByText(riskStyle(route.metrics.worst).label)).toBeInTheDocument()
    }
    // Spelled out once, so a formatting regression can't hide behind the helpers.
    const a = within(card('Route A'))
    expect(a.getByText('742 mi')).toBeInTheDocument()
    expect(a.getByText('11 h 44 min')).toBeInTheDocument()
    expect(a.getByText('0.00 / 4.0')).toBeInTheDocument()
  })

  it('draw the risk strip from owned miles, in order, with a text summary', () => {
    renderPanel(demoPlan)
    const route = routeNamed(demoPlan, 'Route B')

    const strip = within(card('Route B')).getByRole('img')
    const segments = Array.from(strip.children) as HTMLElement[]
    expect(segments).toHaveLength(route.checkpoints.length)
    const total = segments.reduce((sum, s) => sum + parseFloat(s.style.width), 0)
    expect(total).toBeCloseTo(100, 1)
    expect(strip).toHaveAccessibleName(/Risk along the route: .*Severe/)
    expect(segments.some((s) => s.style.backgroundColor !== '')).toBe(true)
  })

  it('mark a route with No travel as not drivable', () => {
    renderPanel(strongHosPlan)

    expect(within(card('Route B')).getByText('Not drivable')).toBeInTheDocument()
    expect(within(card('Route A')).queryByText('Not drivable')).toBeNull()
    expect(within(card('Route B')).getByText('No travel')).toBeInTheDocument()
  })

  it('summarise Hours of Service stops, with rests in hours', async () => {
    renderPanel(strongHosPlan)
    const route = routeNamed(strongHosPlan, 'Route A')

    expect(screen.getByText('ETAs include Hours of Service stops.')).toBeInTheDocument()
    const summary = within(card('Route A')).getByText(
      `Trip ${formatDuration(route.trip_duration_s)} (incl. 1 break, 1 rest)`,
    )
    await userEvent.click(summary)
    expect(within(card('Route A')).getByText('Rest 10 h')).toBeInTheDocument()
    expect(within(card('Route A')).getByText('Break 30 min')).toBeInTheDocument()
    expect(screen.queryByText(/600 min/)).toBeNull()
  })

  it('say when no route is safe', () => {
    const plan = clone(strongHosPlan)
    plan.recommended_route_id = null
    for (const r of plan.routes) r.metrics.drivable = false
    renderPanel(plan)

    expect(screen.getByRole('alert')).toHaveTextContent('No safe route right now')
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  it('show a stale forecast and warnings, naming the route', () => {
    const plan = clone(demoPlan)
    plan.stale = true
    plan.forecast_as_of = new Date(Date.now() - 2 * 3600_000).toISOString()
    plan.warnings = [
      { code: 'only_n_routes_found', message: 'Only 2 distinct routes found', route_id: null },
      { code: 'high_unknown', message: 'No forecast for 31% of this route', route_id: 'r2' },
    ]
    renderPanel(plan)

    expect(screen.getByRole('status')).toHaveTextContent('showing the forecast from 2 h ago')
    expect(screen.getByText('Only 2 distinct routes found')).toBeInTheDocument()
    expect(screen.getByText('Route B:')).toBeInTheDocument()
  })
})

describe('card and map sync (through the UI store)', () => {
  it('clicking a card selects its route', async () => {
    renderPanel(demoPlan)

    await userEvent.click(within(card('Route C')).getByRole('button'))

    expect(useUiStore.getState().selectedRouteId).toBe('r3')
    expect(within(card('Route C')).getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('a selection made elsewhere (the map) shows on the card', () => {
    renderPanel(demoPlan)

    act(() => {
      useUiStore.getState().selectRoute('r2')
    })

    expect(within(card('Route B')).getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('hovering a card hovers its route, and leaving clears it', async () => {
    renderPanel(demoPlan)

    await userEvent.hover(card('Route B'))
    expect(useUiStore.getState().hoveredRouteId).toBe('r2')
    await userEvent.unhover(card('Route B'))
    expect(useUiStore.getState().hoveredRouteId).toBeNull()
  })
})

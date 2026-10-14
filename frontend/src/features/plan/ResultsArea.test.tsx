/**
 * Every planner state (PRD §9, RFC §11) through the whole app, with the
 * network answering as the backend would.
 */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import App from '../../App'
import type { Plan } from '../../api/schema'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { strongHosPlan } from '../../test/fixtures/strongHosPlan'
import { withScrollContainerLayout } from '../../test/layout'
import { freshClient } from '../../test/render'
import { PLANS, apiError, server } from '../../test/server'

const clone = (plan: Plan): Plan => structuredClone<Plan>(plan)

function respondWith(plan: Plan) {
  server.use(http.post(PLANS, () => HttpResponse.json(plan)))
}

/** Plans the demo trip; by default waits until its trip page has opened. */
async function planDemoTrip({ waitForTrip = true } = {}) {
  await userEvent.click(screen.getByRole('button', { name: 'Use the demo trip' }))
  await userEvent.click(screen.getByRole('button', { name: 'Plan trip' }))
  if (waitForTrip) await tripPageOpened()
}

function renderApp() {
  render(<App queryClient={freshClient()} initialPath="/" />)
}

/** A successful plan opens its trip page; it's settled once the saved trip's banner shows. */
async function tripPageOpened() {
  // Plan, navigation and the saved trip's request: allow for a busy test run.
  await screen.findByText(/with the forecast as of then/, undefined, { timeout: 3000 })
}

describe('planner states', () => {
  withScrollContainerLayout()

  it('empty: explains what the planner does', () => {
    renderApp()

    expect(screen.getByRole('heading', { name: 'Plan a weather-aware trip' })).toBeInTheDocument()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('loading: skeletons while the plan is computed, then the routes', async () => {
    server.use(
      http.post(PLANS, async () => {
        await delay(150)
        return HttpResponse.json(demoPlan)
      }),
    )
    renderApp()

    await planDemoTrip({ waitForTrip: false })

    expect(await screen.findByText('Evaluating weather along each route…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Evaluating weather corridors…' })).toBeDisabled()
    expect(await screen.findByRole('list', { name: 'Ranked routes' })).toBeInTheDocument()
    expect(screen.queryByText('Evaluating weather along each route…')).toBeNull()
  })

  it.each([
    [422, 'no_route', 'No truck route between these places'],
    [502, 'routing_unavailable', 'Routing is unavailable'],
    [502, 'weather_unavailable', 'Weather data is unavailable'],
    [500, 'server_error', 'Something went wrong on our side'],
  ])(
    'error %i %s: says what failed, names the service, offers a retry',
    async (status, code, title) => {
      server.use(http.post(PLANS, () => apiError(status, code, 'Backend text.')))
      renderApp()

      await planDemoTrip({ waitForTrip: false })

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(title)
      expect(alert).toHaveTextContent('req-err-0001')
      expect(within(alert).getByRole('button', { name: 'Try again' })).toBeEnabled()
      if (code === 'routing_unavailable') expect(alert).toHaveTextContent('HERE')
      if (code === 'weather_unavailable') expect(alert).toHaveTextContent('Open-Meteo')
      expect(alert).not.toHaveTextContent('NOAA')
    },
  )

  it('quota reached: says routing is paused until next month, with no retry', async () => {
    server.use(http.post(PLANS, () => apiError(503, 'quota_reached', 'Used up.')))
    renderApp()

    await planDemoTrip({ waitForTrip: false })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Live routing is paused until next month')
    expect(alert).toHaveTextContent('HERE')
    expect(within(alert).queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('weather busy: holds the retry for Retry-After and keeps what was fetched', async () => {
    server.use(
      http.post(PLANS, () =>
        apiError(503, 'weather_busy', 'Busy.', { headers: { 'Retry-After': '1' } }),
      ),
    )
    renderApp()

    await planDemoTrip({ waitForTrip: false })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The weather service is busy')
    expect(alert).toHaveTextContent('Open-Meteo')
    expect(within(alert).getByRole('button', { name: 'Try again in 1 s' })).toBeDisabled()
    expect(
      await within(alert).findByRole('button', { name: 'Try again' }, { timeout: 2500 }),
    ).toBeEnabled()
  })

  it('error: a network failure says the server is unreachable', async () => {
    server.use(http.post(PLANS, () => HttpResponse.error()))
    renderApp()

    await planDemoTrip({ waitForTrip: false })

    expect(await screen.findByRole('alert')).toHaveTextContent("Can't reach the server")
  })

  it('rate limited: holds the retry for Retry-After seconds', async () => {
    server.use(
      http.post(PLANS, () =>
        apiError(429, 'rate_limited', 'Too many.', { headers: { 'Retry-After': '1' } }),
      ),
    )
    renderApp()

    await planDemoTrip({ waitForTrip: false })

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Too many requests')
    expect(within(alert).getByRole('button', { name: 'Try again in 1 s' })).toBeDisabled()
    expect(
      await within(alert).findByRole('button', { name: 'Try again' }, { timeout: 2500 }),
    ).toBeEnabled()
  })

  it('a field error stays on the form, not in the results', async () => {
    server.use(
      http.post(PLANS, () =>
        apiError(400, 'invalid_input', 'Some fields are invalid.', {
          fields: { load_lb: ['Ensure this value is less than or equal to 80000.'] },
        }),
      ),
    )
    renderApp()

    await planDemoTrip({ waitForTrip: false })

    expect(
      await screen.findByText('Ensure this value is less than or equal to 80000.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failure after an earlier plan keeps it, dimmed and labelled', async () => {
    renderApp()
    await planDemoTrip()
    server.use(http.post(PLANS, () => apiError(502, 'routing_unavailable', 'Down.')))

    await userEvent.click(screen.getByRole('button', { name: 'Edit trip' }))
    await userEvent.click(screen.getByRole('button', { name: 'Plan trip' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Routing is unavailable')
    expect(
      screen.getByText('Showing your previous plan, not the trip that just failed.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Ranked routes' })).toBeInTheDocument()
  })

  it('partial: fewer than three routes says so', async () => {
    const plan = clone(demoPlan)
    plan.routes = plan.routes.slice(0, 2)
    plan.warnings = [
      {
        code: 'only_n_routes_found',
        message: 'Only 2 distinct routes found for this trip',
        route_id: null,
      },
    ]
    respondWith(plan)
    renderApp()

    await planDemoTrip()

    expect(
      await screen.findByText('Only 2 distinct routes found for this trip'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Ranked routes' })).getAllByRole('listitem'),
    ).toHaveLength(2)
  })

  it('partial: a route with no forecast shows Unknown and No data, never Low or blank', async () => {
    const plan = clone(demoPlan)
    const route = plan.routes[0]
    if (!route) throw new Error('fixture has no routes')
    for (const cp of route.checkpoints) {
      cp.forecast = null
      cp.risk = {
        level: null,
        driver: null,
        wind: null,
        wind_adjusted: null,
        rain: null,
        snow: null,
        load_rule: null,
      }
    }
    route.metrics = {
      ...route.metrics,
      avg_risk: null,
      worst: null,
      worst_at_mile: null,
      miles_by_level: {
        LOW: 0,
        MODERATE: 0,
        HIGH: 0,
        SEVERE: 0,
        NO_TRAVEL: 0,
        UNKNOWN: route.distance_mi,
      },
    }
    respondWith(plan)
    renderApp()

    await planDemoTrip()

    const card = await screen.findByRole('listitem', { name: /^Route A/ })
    expect(within(card).getByText('No data')).toBeInTheDocument()
    expect(within(card).getByText('Unknown')).toBeInTheDocument()
    expect(within(card).queryByText('Low')).toBeNull()
    const table = screen.getByRole('table')
    expect(within(table).queryByText('Low')).toBeNull()
    expect(within(table).getAllByText('Unknown').length).toBeGreaterThan(0)
  })

  it('not drivable: the strong storm marks Route B', async () => {
    respondWith(strongHosPlan)
    renderApp()

    await planDemoTrip()

    const card = await screen.findByRole('listitem', { name: /^Route B/ })
    expect(within(card).getByText('Not drivable')).toBeInTheDocument()
  })

  it('no safe route: nothing recommended, a later departure suggested', async () => {
    const plan = clone(strongHosPlan)
    plan.recommended_route_id = null
    plan.reason_code = 'no_drivable_route'
    for (const r of plan.routes) r.metrics.drivable = false
    respondWith(plan)
    renderApp()

    await planDemoTrip()

    expect(await screen.findByText('No safe route right now')).toBeInTheDocument()
    expect(screen.getByText(/try a later departure/)).toBeInTheDocument()
    expect(screen.queryByText('Recommended')).toBeNull()
  })
})

describe('failure copy', () => {
  it('only mentions a request id when there is one to quote', async () => {
    server.use(http.post(PLANS, () => new HttpResponse('Bad gateway', { status: 500 })))
    render(<App queryClient={freshClient()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Use the demo trip' }))
    await userEvent.click(screen.getByRole('button', { name: 'Plan trip' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Something went wrong on our side')
    expect(alert).not.toHaveTextContent(/request/i)
  })
})

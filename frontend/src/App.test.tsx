import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http } from 'msw'
import { Profiler, type ProfilerOnRenderCallback } from 'react'
import { describe, expect, it } from 'vitest'

import App from './App'
import { AppProviders } from './app/AppProviders'
import { planKeys } from './api/plans'
import { RoutesPanel } from './features/routes-panel/RoutesPanel'
import { HourSlider } from './features/timeline/HourSlider'
import { useTimelineStore } from './state/timeline'
import { useUiStore } from './state/ui'
import { demoPlan } from './test/fixtures/demoPlan'
import { freshClient } from './test/render'
import { PLANS, apiError, server } from './test/server'

const renderApp = () => render(<App queryClient={freshClient()} />)

async function planDemoTrip() {
  await userEvent.click(screen.getByRole('button', { name: 'Use the demo trip' }))
  await userEvent.click(screen.getByRole('button', { name: 'Plan trip' }))
}

describe('App shell', () => {
  it('lays out the header, planner panel, map and timeline as landmarks', () => {
    renderApp()

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Trip planner' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo', { name: 'Forecast timeline' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Plan a weather-aware trip' })).toBeInTheDocument()
  })

  it('gives icon-only controls an accessible name', () => {
    renderApp()

    expect(screen.getByRole('link', { name: /Weather-Aware Truck Routing/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })

  it('switches every surface by toggling the theme on <html>', async () => {
    renderApp()

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toBeInTheDocument()
  })
})

describe('planning the demo trip', () => {
  it('shows the ranked routes, the reason and the demo badge', async () => {
    renderApp()

    await planDemoTrip()

    const routes = await screen.findByRole('list', { name: 'Ranked routes' })
    const items = within(routes).getAllByRole('button')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Route A')
    expect(items[0]).toHaveTextContent('Recommended')
    expect(items[0]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(demoPlan.recommendation_reason)).toBeInTheDocument()
    expect(screen.getByText('Demo data')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Plan a weather-aware trip' })).toBeNull()
  })

  it('selects a route on click', async () => {
    renderApp()
    await planDemoTrip()
    await screen.findByRole('list', { name: 'Ranked routes' })
    const routeA = screen.getByRole('button', { name: /Route A/ })
    const routeB = screen.getByRole('button', { name: /Route B/ })

    await userEvent.click(routeB)

    expect(routeB).toHaveAttribute('aria-pressed', 'true')
    expect(routeA).toHaveAttribute('aria-pressed', 'false')
    expect(useUiStore.getState().selectedRouteId).toBe(
      demoPlan.routes.find((r) => r.name === 'Route B')?.id,
    )
  })

  it('shows the failure with its request id, and retries on request', async () => {
    server.use(
      http.post(PLANS, () => apiError(422, 'no_route', 'No truck route was found.'), {
        once: true,
      }),
    )
    renderApp()

    await planDemoTrip()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No truck route between these places')
    expect(alert).toHaveTextContent('req-err-0001')

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('list', { name: 'Ranked routes' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('render isolation', () => {
  it('moving the forecast hour does not re-render the routes panel', () => {
    const client = freshClient()
    client.setQueryData(planKeys.current(), demoPlan)
    const commits: string[] = []
    const onRender: ProfilerOnRenderCallback = (id) => commits.push(id)
    render(
      <AppProviders queryClient={client}>
        <Profiler id="routes" onRender={onRender}>
          <RoutesPanel />
        </Profiler>
        <Profiler id="slider" onRender={onRender}>
          <HourSlider />
        </Profiler>
      </AppProviders>,
    )
    commits.length = 0

    const slider = screen.getByRole('slider')
    for (const hour of [1, 2, 6, 12, 24, 48]) {
      fireEvent.change(slider, { target: { value: String(hour) } })
    }
    act(() => {
      useTimelineStore.getState().step(-1)
    })

    expect(slider).toHaveValue('47')
    expect(commits.filter((id) => id === 'slider')).toHaveLength(7)
    expect(commits.filter((id) => id === 'routes')).toHaveLength(0)
  })

  it('selecting a route re-renders only the two affected items, not the list', () => {
    const client = freshClient()
    client.setQueryData(planKeys.current(), demoPlan)
    let listRenders = 0
    render(
      <AppProviders queryClient={client}>
        <Profiler
          id="routes"
          onRender={(_id, phase) => {
            if (phase === 'update') listRenders += 1
          }}
        >
          <RoutesPanel />
        </Profiler>
      </AppProviders>,
    )
    act(() => {
      useUiStore.getState().selectRoute('r1')
    })
    listRenders = 0

    act(() => {
      useUiStore.getState().selectRoute('r2')
    })

    // One commit, for the items whose selected state changed; hovering
    // elsewhere in the UI store doesn't touch the list at all.
    expect(listRenders).toBe(1)
    act(() => {
      useUiStore.getState().hoverCheckpoint({ routeId: 'r2', index: 3 })
    })
    expect(listRenders).toBe(1)
  })
})

import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { heatmapKeys } from '../../api/heatmap'
import type { Route } from '../../api/schema'
import { useTimelineStore } from '../../state/timeline'
import { useUiStore } from '../../state/ui'
import { demoHeatmap } from '../../test/fixtures/demoHeatmap'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { renderMap } from '../../test/renderMap'
import { HEATMAP, server } from '../../test/server'
import { buildTruckTrack, truckAt } from './truckTrack'

// The demo routes all leave at 09:00 UTC.
const DEPARTURE = Date.parse(demoPlan.routes[0].departure)
const HOUR = 3600_000

/**
 * The map with the heatmap loaded, so slider hours count from its first
 * hour: by default the departure, so hour h is h hours into the trip.
 */
async function renderAtHour(hour: number, heatmapStart = new Date(DEPARTURE).toISOString()) {
  server.use(
    http.get(HEATMAP, () => HttpResponse.json({ ...demoHeatmap, start_hour: heatmapStart })),
  )
  act(() => {
    useTimelineStore.getState().setHour(hour)
  })
  const view = renderMap(demoPlan)
  // Until the heatmap arrives, hour 0 is the hour after the plan was made.
  await waitFor(() => {
    expect(view.client.getQueryState(heatmapKeys.trip(demoPlan.trip_id))?.status).toBe('success')
  })
  return view
}

const trucks = () => screen.queryAllByRole('img', { name: /truck/ })

describe('truck markers', () => {
  it('show where each route is at the slider hour', async () => {
    await renderAtHour(5)

    const at = DEPARTURE + 5 * HOUR
    const names = trucks().map((t) => t.getAttribute('aria-label'))
    expect(names).toHaveLength(3)
    for (const route of demoPlan.routes) {
      const truck = truckAt(buildTruckTrack(route), at)
      const marker = screen.getByRole('img', { name: new RegExp(`^${route.name} truck`) })
      expect(marker.closest('[data-testid="marker"]')).toHaveAttribute(
        'data-lnglat',
        `${String(truck?.lon)},${String(truck?.lat)}`,
      )
    }
  })

  it('draw the selected route full size and the others small', async () => {
    await renderAtHour(5)

    const selected = demoPlan.routes.find((r) => r.id === demoPlan.recommended_route_id) as Route
    for (const marker of trucks()) {
      const isSelected = marker.getAttribute('aria-label')?.startsWith(selected.name) ?? false
      expect(marker).toHaveClass(isSelected ? 'size-7' : 'size-5')
    }
  })

  it('move with the slider', async () => {
    await renderAtHour(2)
    const route = demoPlan.routes[0] as Route
    const label = () =>
      screen
        .getByRole('img', { name: new RegExp(`^${route.name} truck`) })
        .getAttribute('aria-label')
    const before = label()

    act(() => {
      useTimelineStore.getState().setHour(3)
    })

    expect(label()).not.toBe(before)
  })

  it('are hidden before the trucks leave', async () => {
    await renderAtHour(0, new Date(DEPARTURE - 2 * HOUR).toISOString())
    expect(trucks()).toHaveLength(0)
  })

  it('are hidden once every truck has arrived', async () => {
    await renderAtHour(30)
    expect(trucks()).toHaveLength(0)
  })

  it("follow the other routes' switch, keeping the selected route's truck", async () => {
    await renderAtHour(5)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Other routes' }))

    expect(trucks()).toHaveLength(1)
    const selected = useUiStore.getState().selectedRouteId
    const name = demoPlan.routes.find((r) => r.id === selected)?.name ?? ''
    expect(trucks()[0]).toHaveAccessibleName(new RegExp(`^${name} truck`))
  })
})

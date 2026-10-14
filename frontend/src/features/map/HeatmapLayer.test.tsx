import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useTimelineStore } from '../../state/timeline'
import { useUiStore, type HeatmapMetric } from '../../state/ui'
import { fake, layer, source } from '../../test/fakeMap'
import { demoHeatmap, demoHeatmapWithMetrics } from '../../test/fixtures/demoHeatmap'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { setReducedMotion } from '../../test/matchMedia'
import { renderMap, showPlan } from '../../test/renderMap'
import { HEATMAP, apiError, server } from '../../test/server'
import { buildHeatmapGeometry } from './heatmapGeometry'
import { HEATMAP_OPACITY, LAYER, SOURCE, heatmapWeight } from './layers'

// Animation frames wait in a queue until a test runs them, so a test can see
// what happens before and after one frame.
let frames: FrameRequestCallback[] = []

function nextFrame() {
  act(() => {
    const due = frames
    frames = []
    due.forEach((callback) => {
      callback(performance.now())
    })
  })
}

beforeEach(() => {
  frames = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback)
    return frames.length
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
})

/** Records the trip ids the heatmap is requested for. */
function recordRequests() {
  const tripIds: string[] = []
  server.use(
    http.get(HEATMAP, ({ params }) => {
      tripIds.push(String(params.tripId))
      return HttpResponse.json(demoHeatmap)
    }),
  )
  return tripIds
}

async function heatmapArrives() {
  await waitFor(() => {
    expect(fake.sources.has(SOURCE.heatmap)).toBe(true)
  })
}

describe('heatmap layer', () => {
  it('requests nothing before a trip is planned', async () => {
    const tripIds = recordRequests()
    renderMap()

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(tripIds).toEqual([])
    expect(fake.sources.has(SOURCE.heatmap)).toBe(false)
  })

  it("draws the plan's heatmap under the routes, which are on the map first", async () => {
    const tripIds = recordRequests()
    renderMap(demoPlan)

    expect(fake.sources.has(SOURCE.routes)).toBe(true)
    expect(fake.sources.has(SOURCE.heatmap)).toBe(false)

    await heatmapArrives()
    expect(tripIds).toEqual([demoPlan.trip_id])
    expect(layer(LAYER.heatmap)).toMatchObject({
      type: 'heatmap',
      source: SOURCE.heatmap,
      beforeId: LAYER.otherRoutes,
    })
    expect(source(SOURCE.heatmap).props.data).toMatchObject({
      features: demoHeatmap.points.map((coordinates) => ({ geometry: { coordinates } })),
    })
  })

  it('fades in when it arrives', async () => {
    renderMap(demoPlan)
    await heatmapArrives()

    expect(layer(LAYER.heatmap).paint).toMatchObject({
      'heatmap-opacity': 0,
      'heatmap-opacity-transition': { duration: 600, delay: 0 },
    })
    nextFrame()
    expect(layer(LAYER.heatmap).paint).toMatchObject({ 'heatmap-opacity': HEATMAP_OPACITY })
  })

  it('appears without the fade when the system asks for less motion', async () => {
    setReducedMotion(true)
    renderMap(demoPlan)
    await heatmapArrives()

    expect(layer(LAYER.heatmap).paint).toMatchObject({
      'heatmap-opacity-transition': { duration: 0, delay: 0 },
    })
  })

  it('starts at the hour the slider is on', async () => {
    act(() => {
      useTimelineStore.getState().setHour(12)
    })
    renderMap(demoPlan)
    await heatmapArrives()

    expect(layer(LAYER.heatmap).paint).toMatchObject({ 'heatmap-weight': heatmapWeight(12) })
  })

  it('follows the slider with one paint update a frame, without rendering or new data', async () => {
    renderMap(demoPlan)
    await heatmapArrives()
    nextFrame()
    const paint = layer(LAYER.heatmap).paint

    act(() => {
      useTimelineStore.getState().setHour(5)
      useTimelineStore.getState().setHour(6)
      useTimelineStore.getState().setHour(7)
    })
    expect(fake.map.setPaintProperty).not.toHaveBeenCalled()

    nextFrame()
    expect(fake.map.setPaintProperty).toHaveBeenCalledTimes(1)
    expect(fake.map.setPaintProperty).toHaveBeenCalledWith(
      LAYER.heatmap,
      'heatmap-weight',
      heatmapWeight(7),
    )
    expect(layer(LAYER.heatmap).paint).toBe(paint)
    expect(source(SOURCE.heatmap).setData).not.toHaveBeenCalled()
  })

  it('is hidden by its legend switch, by visibility alone', async () => {
    renderMap(demoPlan)
    await heatmapArrives()
    expect(layer(LAYER.heatmap).layout).toEqual({ visibility: 'visible' })

    await userEvent.click(screen.getByRole('checkbox', { name: 'Heatmap' }))

    expect(layer(LAYER.heatmap).layout).toEqual({ visibility: 'none' })
    expect(source(SOURCE.heatmap).setData).not.toHaveBeenCalled()
  })

  it('requests the heatmap of each new trip', async () => {
    const tripIds = recordRequests()
    const { client } = renderMap(demoPlan)
    await heatmapArrives()

    const replanned = { ...demoPlan, trip_id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' }
    showPlan(client, replanned)

    await waitFor(() => {
      expect(tripIds).toEqual([demoPlan.trip_id, replanned.trip_id])
    })
  })

  it('leaves the routes on the map when the heatmap fails', async () => {
    let requests = 0
    server.use(
      http.get(HEATMAP, () => {
        requests += 1
        return apiError(502, 'weather_unavailable', 'Down.')
      }),
    )
    renderMap(demoPlan)

    await waitFor(() => {
      expect(requests).toBe(2) // one retry, as for any transient failure
    })
    expect(fake.sources.has(SOURCE.heatmap)).toBe(false)
    expect(fake.sources.has(SOURCE.routes)).toBe(true)
  })

  it('retries a busy weather service until the heatmap completes', async () => {
    let requests = 0
    server.use(
      http.get(HEATMAP, () => {
        requests += 1
        if (requests <= 2) {
          return apiError(503, 'weather_busy', 'Busy.', { headers: { 'Retry-After': '40' } })
        }
        return HttpResponse.json(demoHeatmap)
      }),
    )
    renderMap(demoPlan)

    await waitFor(() => {
      expect(fake.sources.has(SOURCE.heatmap)).toBe(true)
    })
    expect(requests).toBe(3)
  })

  it('gives up when the weather allowance is out for longer than a couple of minutes', async () => {
    let requests = 0
    server.use(
      http.get(HEATMAP, () => {
        requests += 1
        return apiError(503, 'weather_busy', 'Busy.', { headers: { 'Retry-After': '1800' } })
      }),
    )
    renderMap(demoPlan)

    await waitFor(() => {
      expect(requests).toBe(1)
    })
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(requests).toBe(1)
    expect(fake.sources.has(SOURCE.routes)).toBe(true)
  })
})

describe('heatmap metric', () => {
  /** Records each heatmap request: whether it asked for the conditions. */
  function recordIncludes(respond?: (metrics: boolean) => Promise<Response> | Response) {
    const includes: boolean[] = []
    server.use(
      http.get(HEATMAP, ({ request }) => {
        const metrics = new URL(request.url).searchParams.get('include') === 'metrics'
        includes.push(metrics)
        if (respond) return respond(metrics)
        return HttpResponse.json(metrics ? demoHeatmapWithMetrics : demoHeatmap)
      }),
    )
    return includes
  }

  const choose = (metric: HeatmapMetric) => {
    act(() => {
      useUiStore.getState().showHeatmapMetric(metric)
    })
  }

  it('fetches the conditions once, when one is first chosen, then switches by paint alone', async () => {
    const includes = recordIncludes()
    renderMap(demoPlan)
    await heatmapArrives()
    nextFrame()
    expect(includes).toEqual([false])

    choose('wind')
    await waitFor(() => {
      expect(layer(LAYER.heatmap).paint).toMatchObject({
        'heatmap-weight': heatmapWeight(0, 'wind'),
      })
    })
    expect(includes).toEqual([false, true])
    expect(source(SOURCE.heatmap).setData).toHaveBeenCalledTimes(1)
    const sent = source(SOURCE.heatmap).setData.mock.calls[0]?.[0]
    expect(sent).toEqual(buildHeatmapGeometry(demoHeatmapWithMetrics))

    for (const metric of ['rain', 'snow', 'risk', 'wind'] as const) {
      choose(metric)
      expect(layer(LAYER.heatmap).paint).toMatchObject({
        'heatmap-weight': heatmapWeight(0, metric),
      })
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(includes).toEqual([false, true])
    expect(source(SOURCE.heatmap).setData).toHaveBeenCalledTimes(1)
  })

  it('keeps the overall rating on show while the conditions load', async () => {
    let release: () => void = () => undefined
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    recordIncludes(async (metrics) => {
      if (metrics) await held
      return HttpResponse.json(metrics ? demoHeatmapWithMetrics : demoHeatmap)
    })
    renderMap(demoPlan)
    await heatmapArrives()
    nextFrame()

    choose('rain')
    expect(layer(LAYER.heatmap).paint).toMatchObject({ 'heatmap-weight': heatmapWeight(0) })

    release()
    await waitFor(() => {
      expect(layer(LAYER.heatmap).paint).toMatchObject({
        'heatmap-weight': heatmapWeight(0, 'rain'),
      })
    })
    // The trip's heatmap faded in once; the conditions arriving don't fade it again.
    expect(layer(LAYER.heatmap).paint).toMatchObject({ 'heatmap-opacity': HEATMAP_OPACITY })
  })

  it("follows the slider in the chosen condition's levels", async () => {
    renderMap(demoPlan)
    await heatmapArrives()
    nextFrame()
    choose('wind')
    await waitFor(() => {
      expect(source(SOURCE.heatmap).setData).toHaveBeenCalledTimes(1)
    })

    act(() => {
      useTimelineStore.getState().setHour(9)
    })
    nextFrame()

    expect(fake.map.setPaintProperty).toHaveBeenLastCalledWith(
      LAYER.heatmap,
      'heatmap-weight',
      heatmapWeight(9, 'wind'),
    )
  })

  it('stays on the overall rating when the trip has no conditions kept', async () => {
    recordIncludes((metrics) =>
      HttpResponse.json(metrics ? { ...demoHeatmap, metrics: null } : demoHeatmap),
    )
    renderMap(demoPlan)
    await heatmapArrives()

    choose('snow')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(layer(LAYER.heatmap).paint).toMatchObject({ 'heatmap-weight': heatmapWeight(0) })
  })
})

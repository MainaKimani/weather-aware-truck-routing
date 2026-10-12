import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { demoTripRequest } from '../features/plan/demoTrip'
import { useUiStore } from '../state/ui'
import { demoHeatmap } from '../test/fixtures/demoHeatmap'
import { demoPlan } from '../test/fixtures/demoPlan'
import { renderHookWithClient } from '../test/render'
import { HEATMAP, PLANS, apiError, server } from '../test/server'
import { heatmapKeys } from './heatmap'
import { planKeys, usePlan, usePlanTrip } from './plans'

describe('usePlanTrip', () => {
  it('puts the plan in the cache and selects the recommended route', async () => {
    useUiStore.getState().selectRoute('r3')
    const { result, client } = renderHookWithClient(() => usePlanTrip())

    act(() => {
      result.current.plan(demoTripRequest())
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(client.getQueryData(planKeys.current())).toEqual(demoPlan)
    expect(useUiStore.getState().selectedRouteId).toBe('r1')
  })

  it("requests the trip's heatmap once the plan has arrived, not before", async () => {
    const log: string[] = []
    server.use(
      http.post(PLANS, async () => {
        log.push('plan requested')
        await new Promise((resolve) => setTimeout(resolve, 20))
        log.push('plan answered')
        return HttpResponse.json(demoPlan)
      }),
      http.get(HEATMAP, ({ params }) => {
        log.push(`heatmap requested for ${String(params.tripId)}`)
        return HttpResponse.json(demoHeatmap)
      }),
    )
    const { result, client } = renderHookWithClient(() => usePlanTrip())

    act(() => {
      result.current.plan(demoTripRequest())
    })
    await waitFor(() => {
      expect(client.getQueryData(heatmapKeys.trip(demoPlan.trip_id))).toEqual(demoHeatmap)
    })

    expect(log).toEqual([
      'plan requested',
      'plan answered',
      `heatmap requested for ${demoPlan.trip_id}`,
    ])
  })

  it('requests no heatmap when the plan fails', async () => {
    let heatmaps = 0
    server.use(
      http.post(PLANS, () => apiError(422, 'no_route', 'No route.')),
      http.get(HEATMAP, () => {
        heatmaps += 1
        return HttpResponse.json(demoHeatmap)
      }),
    )
    const { result } = renderHookWithClient(() => usePlanTrip())

    act(() => {
      result.current.plan(demoTripRequest())
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(heatmaps).toBe(0)
  })

  it('sends one Idempotency-Key per submission, reused by the automatic retry', async () => {
    const keys: (string | null)[] = []
    server.use(
      http.post(PLANS, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'))
        return keys.length === 1
          ? apiError(502, 'routing_unavailable', 'Down.')
          : HttpResponse.json(demoPlan)
      }),
    )
    const { result } = renderHookWithClient(() => usePlanTrip())

    act(() => {
      result.current.plan(demoTripRequest())
    })
    await waitFor(
      () => {
        expect(result.current.isSuccess).toBe(true)
      },
      { timeout: 3000 },
    )

    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[1]).toBe(keys[0])

    act(() => {
      result.current.plan(demoTripRequest())
    })
    await waitFor(() => {
      expect(keys).toHaveLength(3)
    })
    expect(keys[2]).not.toBe(keys[0])
  })

  it.each([
    [400, 'invalid_input'],
    [422, 'no_route'],
    [429, 'rate_limited'],
  ])('does not retry %i %s', async (status, code) => {
    let calls = 0
    server.use(
      http.post(PLANS, () => {
        calls += 1
        return apiError(status, code, 'No.')
      }),
    )
    const { result } = renderHookWithClient(() => usePlanTrip())

    act(() => {
      result.current.plan(demoTripRequest())
    })
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(calls).toBe(1)
    expect(result.current.error?.code).toBe(code)
  })
})

describe('usePlan', () => {
  it('is undefined before the first plan', () => {
    const { result } = renderHookWithClient(() => usePlan())

    expect(result.current).toBeUndefined()
  })

  it('returns only the selected slice', async () => {
    const { result, client } = renderHookWithClient(() => usePlan((plan) => plan.routes.length))

    act(() => {
      client.setQueryData(planKeys.current(), demoPlan)
    })

    await waitFor(() => {
      expect(result.current).toBe(3)
    })
  })
})

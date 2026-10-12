import { act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { demoTripRequest } from '../features/plan/demoTrip'
import { useUiStore } from '../state/ui'
import { demoPlan } from '../test/fixtures/demoPlan'
import { renderHookWithClient } from '../test/render'
import { PLANS, apiError, server } from '../test/server'
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

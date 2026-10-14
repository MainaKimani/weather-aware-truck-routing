import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { PLANS, SUGGEST, apiError, server } from '../test/server'
import { demoTripRequest } from '../features/plan/demoTrip'
import { api, readCookie, unwrap } from './client'
import { ApiError } from './errors'

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }
  throw new Error('expected the request to fail')
}

const postPlan = () => unwrap(api.POST('/api/v1/plans', { body: demoTripRequest() }))

describe('API client', () => {
  it('returns typed data on success', async () => {
    const plan = await postPlan()

    expect(plan.recommended_route_id).toBe('r1')
    expect(plan.routes).toHaveLength(3)
  })

  it('turns a validation error into ApiError with field messages and request id', async () => {
    server.use(
      http.post(PLANS, () =>
        apiError(400, 'invalid_input', 'Some fields are invalid.', {
          fields: { 'hos.drive_left_h': ["Can't be more than the shift window."] },
        }),
      ),
    )

    const error = await failure(postPlan())

    expect(error).toMatchObject({
      code: 'invalid_input',
      status: 400,
      message: 'Some fields are invalid.',
      requestId: 'req-err-0001',
    })
    expect(error.fields['hos.drive_left_h']).toEqual(["Can't be more than the shift window."])
    expect(error.transient).toBe(false)
  })

  it.each([
    [422, 'no_route', false],
    [502, 'routing_unavailable', true],
    [502, 'weather_unavailable', true],
    [503, 'quota_reached', false],
  ])('maps %i %s (transient: %s)', async (status, code, transient) => {
    server.use(http.post(PLANS, () => apiError(status, code, 'Nope.')))

    const error = await failure(postPlan())

    expect(error.code).toBe(code)
    expect(error.status).toBe(status)
    expect(error.transient).toBe(transient)
  })

  it('reads Retry-After on 429', async () => {
    server.use(
      http.post(PLANS, () =>
        apiError(429, 'rate_limited', 'Too many requests.', { headers: { 'Retry-After': '42' } }),
      ),
    )

    const error = await failure(postPlan())

    expect(error).toMatchObject({ code: 'rate_limited', retryAfterS: 42 })
  })

  it('handles a non-JSON error page from a proxy', async () => {
    server.use(http.post(PLANS, () => new HttpResponse('<h1>Bad gateway</h1>', { status: 502 })))

    const error = await failure(postPlan())

    expect(error).toMatchObject({ code: 'server_error', status: 502, transient: true })
    expect(error.message).toContain('502')
  })

  it('reports a network failure as network_error', async () => {
    server.use(http.post(PLANS, () => HttpResponse.error()))

    const error = await failure(postPlan())

    expect(error).toMatchObject({ code: 'network_error', status: 0, transient: true })
  })

  it('rethrows an abort untouched', async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      unwrap(
        api.GET('/api/v1/geocode/suggest', {
          params: { query: { q: 'dal' } },
          signal: controller.signal,
        }),
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('sends the CSRF token on unsafe requests only', async () => {
    document.cookie = 'csrftoken=tok%2B123'
    const seen: Record<string, string | null> = {}
    server.use(
      http.post(PLANS, ({ request }) => {
        seen.post = request.headers.get('X-CSRFToken')
        return HttpResponse.json({})
      }),
      http.get(SUGGEST, ({ request }) => {
        seen.get = request.headers.get('X-CSRFToken')
        return HttpResponse.json([])
      }),
    )

    await api.POST('/api/v1/plans', { body: demoTripRequest() })
    await api.GET('/api/v1/geocode/suggest', { params: { query: { q: 'da' } } })

    expect(readCookie('csrftoken')).toBe('tok+123')
    expect(seen).toEqual({ post: 'tok+123', get: null })
  })
})

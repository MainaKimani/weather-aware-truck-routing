/**
 * The network boundary for tests (Mock Service Worker). Tests exercise the
 * real client, hooks and components; only the HTTP responses are fake.
 * Unhandled requests fail the test, so nothing reaches a real server.
 */
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { demoHeatmap, demoHeatmapWithMetrics } from './fixtures/demoHeatmap'
import { demoPlan } from './fixtures/demoPlan'

export const PLANS = '*/api/v1/plans'
export const SUGGEST = '*/api/v1/geocode/suggest'
export const HEATMAP = '*/api/v1/trips/:tripId/heatmap'

export const handlers = [
  http.post(PLANS, () =>
    HttpResponse.json(demoPlan, { headers: { 'X-Request-ID': 'req-plan-0001' } }),
  ),
  http.get(HEATMAP, ({ request }) =>
    HttpResponse.json(
      new URL(request.url).searchParams.get('include') === 'metrics'
        ? demoHeatmapWithMetrics
        : demoHeatmap,
    ),
  ),
  http.get(SUGGEST, ({ request }) => {
    const q = new URL(request.url).searchParams.get('q') ?? ''
    const places = [
      { label: 'Dallas, TX', lat: 32.7767, lon: -96.797, tz: 'America/Chicago' },
      { label: 'Denver, CO', lat: 39.7392, lon: -104.9903, tz: 'America/Denver' },
    ]
    return HttpResponse.json(places.filter((p) => p.label.toLowerCase().startsWith(q)))
  }),
]

export const server = setupServer(...handlers)

export function apiError(
  status: number,
  code: string,
  message: string,
  extra: { fields?: Record<string, string[]>; headers?: Record<string, string> } = {},
) {
  return HttpResponse.json(
    { error: { code, message, ...(extra.fields ? { fields: extra.fields } : {}) } },
    { status, headers: { 'X-Request-ID': 'req-err-0001', ...extra.headers } },
  )
}

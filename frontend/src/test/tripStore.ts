/**
 * A small in-memory trip API for tests of the trip lists and actions: lists
 * in pages of 20 with a cursor, the `saved` and `q` filters, and PATCH and
 * DELETE on a trip, as the backend answers them (RFC §7.4).
 */
import { http, HttpResponse } from 'msw'

import type { PatchedTripUpdateRequest, TripSummary } from '../api/schema'
import { summaryFromPlan } from '../api/trips'
import { demoPlan } from './fixtures/demoPlan'
import { savedTrip } from './fixtures/savedTrip'
import { ME, TRIP, TRIPS, server, signedIn } from './server'

export const PAGE = 20

/** `count` distinct trips, newest first: "Trip 1" is the newest. */
export function makeTrips(count: number): TripSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    ...summaryFromPlan(demoPlan),
    id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
    name: `Trip ${String(i + 1)}`,
    created_at: new Date(Date.UTC(2026, 9, 12) - i * 60_000).toISOString(),
  }))
}

export function serveTripStore(initial: TripSummary[]) {
  const trips = [...initial]
  const lists: URLSearchParams[] = []
  const patches: { id: string; body: PatchedTripUpdateRequest }[] = []
  const deletes: string[] = []
  server.use(
    http.get(ME, () => HttpResponse.json(signedIn('driver@example.com', trips.length))),
    http.get(TRIPS, ({ request }) => {
      const url = new URL(request.url)
      lists.push(url.searchParams)
      const q = url.searchParams.get('q')?.toLowerCase() ?? ''
      const saved = url.searchParams.get('saved')
      const matching = trips.filter(
        (t) =>
          (saved === null || String(t.saved) === saved) &&
          (!q || `${t.name} ${t.origin} ${t.destination}`.toLowerCase().includes(q)),
      )
      const start = Number(url.searchParams.get('cursor') ?? 0)
      const end = start + PAGE
      const next = new URL(url)
      next.searchParams.set('cursor', String(end))
      return HttpResponse.json({
        next: end < matching.length ? next.toString() : null,
        previous: null,
        results: matching.slice(start, end),
      })
    }),
    http.patch(TRIP, async ({ params, request }) => {
      const id = String(params.tripId)
      const body = (await request.json()) as PatchedTripUpdateRequest
      patches.push({ id, body })
      const index = trips.findIndex((t) => t.id === id)
      const row = trips[index]
      if (!row) {
        return HttpResponse.json(
          { error: { code: 'not_found', message: 'Not found.' } },
          { status: 404 },
        )
      }
      const changed = { ...row, ...body }
      trips[index] = changed
      const meta = { name: changed.name, saved: changed.saved, shared: changed.shared }
      return HttpResponse.json(savedTrip({ ...demoPlan, trip_id: id }, meta))
    }),
    http.delete(TRIP, ({ params }) => {
      const id = String(params.tripId)
      deletes.push(id)
      trips.splice(
        trips.findIndex((t) => t.id === id),
        1,
      )
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { trips, lists, patches, deletes }
}

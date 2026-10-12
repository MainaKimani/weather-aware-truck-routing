/**
 * Saved trips (RFC §7.4). Every plan is a trip; its page reads it back
 * exactly as it was planned.
 *
 * Keys start with ['trips', id] like the heatmap's, so a trip's queries can
 * be found together.
 */
import { useQuery, type QueryClient } from '@tanstack/react-query'

import { api, unwrap } from './client'
import type { ApiError } from './errors'
import { meKeys } from './me'
import type { Plan, Trip, TripPage, TripSummary } from './schema'

export interface TripFilters {
  saved?: boolean
  q?: string
}

export const tripKeys = {
  all: ['trips'] as const,
  lists: () => ['trips', 'list'] as const,
  /** The header's recent trips: the first page, unfiltered. */
  recent: () => ['trips', 'list', 'recent'] as const,
  detail: (tripId: string) => ['trips', tripId, 'detail'] as const,
}

export function fetchTripPage(
  filters: TripFilters & { cursor?: string },
  signal?: AbortSignal,
): Promise<TripPage> {
  return unwrap(api.GET('/api/v1/trips', { params: { query: filters }, signal }))
}

/** The caller's latest trips (a guest's last 20), fetched once `enabled`. */
export function useRecentTrips(enabled: boolean) {
  return useQuery<TripPage, ApiError>({
    queryKey: tripKeys.recent(),
    queryFn: ({ signal }) => fetchTripPage({}, signal),
    enabled,
  })
}

/** A new plan as a trip list shows it: what the list will say once it's fetched again. */
export function summaryFromPlan(plan: Plan): TripSummary {
  const route = plan.routes.find((r) => r.id === plan.recommended_route_id)
  return {
    id: plan.trip_id,
    created_at: plan.generated_at,
    name: '',
    saved: false,
    shared: false,
    origin: plan.inputs.origin.label,
    destination: plan.inputs.destination.label,
    departure: plan.inputs.departure,
    load_lb: plan.inputs.load_lb,
    interval_mi: plan.inputs.interval_mi,
    demo: plan.demo,
    stale: plan.stale,
    recommended: route
      ? {
          id: route.id,
          name: route.name,
          label: route.label,
          worst: route.metrics.worst,
          drivable: route.metrics.drivable,
        }
      : null,
  }
}

/**
 * A plan was just saved: it goes to the top of the recent trips at once, and
 * every list and the trip count are fetched again behind it.
 */
export function addPlannedTrip(queryClient: QueryClient, plan: Plan): void {
  const summary = summaryFromPlan(plan)
  queryClient.setQueryData<TripPage>(tripKeys.recent(), (page) =>
    page
      ? {
          ...page,
          results: [summary, ...page.results.filter((t) => t.id !== summary.id)].slice(0, 20),
        }
      : page,
  )
  void queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
  void queryClient.invalidateQueries({ queryKey: meKeys.all })
}

export function fetchTrip(tripId: string, signal?: AbortSignal): Promise<Trip> {
  return unwrap(
    api.GET('/api/v1/trips/{trip_id}', { params: { path: { trip_id: tripId } }, signal }),
  )
}

/** A saved trip; it never changes unless its owner renames, saves or shares it. */
export function useTrip(tripId: string) {
  return useQuery<Trip, ApiError>({
    queryKey: tripKeys.detail(tripId),
    queryFn: ({ signal }) => fetchTrip(tripId, signal),
    staleTime: Infinity,
  })
}

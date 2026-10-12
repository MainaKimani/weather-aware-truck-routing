/**
 * Saved trips (RFC §7.4). Every plan is a trip; its page reads it back
 * exactly as it was planned.
 *
 * Keys start with ['trips', id] like the heatmap's, so a trip's queries can
 * be found together.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'

import { api, unwrap, unwrapEmpty } from './client'
import type { ApiError } from './errors'
import { meKeys } from './me'
import type { PatchedTripUpdateRequest, Plan, Trip, TripPage, TripSummary } from './schema'

export interface TripFilters {
  saved?: boolean
  q?: string
}

export const tripKeys = {
  all: ['trips'] as const,
  lists: () => ['trips', 'list'] as const,
  /** The header's recent trips: the first page, unfiltered. */
  recent: () => ['trips', 'list', 'recent'] as const,
  /** My trips, by tab and search. */
  list: ({ saved, q = '' }: TripFilters) => ['trips', 'list', { saved: saved ?? null, q }] as const,
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

/** The cursor in a page's `next` link, or null on the last page. */
function cursorFrom(next: string | null): string | null {
  return next ? new URL(next, window.location.origin).searchParams.get('cursor') : null
}

/** All the user's trips matching the filters, newest first, a page at a time. */
export function useTripList(filters: TripFilters) {
  return useInfiniteQuery<
    TripPage,
    ApiError,
    InfiniteData<TripPage>,
    ReturnType<typeof tripKeys.list>,
    string | null
  >({
    queryKey: tripKeys.list(filters),
    queryFn: ({ pageParam, signal }) =>
      fetchTripPage({ ...filters, cursor: pageParam ?? undefined }, signal),
    initialPageParam: null,
    getNextPageParam: (last) => cursorFrom(last.next),
  })
}

// --- Changing trips ----------------------------------------------------------

type ListData = TripPage | InfiniteData<TripPage> | undefined

/** Every cached list, each row passed through `change` (null drops the row). */
function editLists(
  queryClient: QueryClient,
  change: (row: TripSummary) => TripSummary | null,
): void {
  const editPage = (page: TripPage): TripPage => ({
    ...page,
    results: page.results.flatMap((row) => change(row) ?? []),
  })
  queryClient.setQueriesData<ListData>({ queryKey: tripKeys.lists() }, (data) => {
    if (!data) return data
    if ('pages' in data) return { ...data, pages: data.pages.map(editPage) }
    return editPage(data)
  })
}

export interface TripChange {
  tripId: string
  changes: PatchedTripUpdateRequest
}

export function updateTrip({ tripId, changes }: TripChange): Promise<Trip> {
  return unwrap(
    api.PATCH('/api/v1/trips/{trip_id}', { params: { path: { trip_id: tripId } }, body: changes }),
  )
}

export function deleteTrip(tripId: string): Promise<null> {
  return unwrapEmpty(
    api.DELETE('/api/v1/trips/{trip_id}', { params: { path: { trip_id: tripId } } }),
  )
}

/**
 * Rename, save or share a trip. Its page and every list showing it update
 * at once; lists are then fetched again, since a change can move a trip in
 * or out of one (saving, under Saved).
 */
export function useUpdateTrip() {
  const queryClient = useQueryClient()
  return useMutation<Trip, ApiError, TripChange>({
    mutationFn: updateTrip,
    onSuccess: (trip) => {
      queryClient.setQueryData(tripKeys.detail(trip.trip_id), trip)
      editLists(queryClient, (row) =>
        row.id === trip.trip_id
          ? { ...row, name: trip.name, saved: trip.saved, shared: trip.shared }
          : row,
      )
      void queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
    },
  })
}

/** Delete a trip: gone from its page's cache and every list at once. */
export function useDeleteTrip() {
  const queryClient = useQueryClient()
  return useMutation<null, ApiError, string>({
    mutationFn: deleteTrip,
    onSuccess: (_, tripId) => {
      editLists(queryClient, (row) => (row.id === tripId ? null : row))
      queryClient.removeQueries({ queryKey: tripKeys.detail(tripId) })
      void queryClient.invalidateQueries({ queryKey: tripKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: meKeys.all })
    },
  })
}

/** Plan a trip again with current weather; one Idempotency-Key per request. */
export function replanTrip(tripId: string): Promise<Trip> {
  return unwrap(
    api.POST('/api/v1/trips/{trip_id}/replan', {
      params: { path: { trip_id: tripId } },
      headers: { 'Idempotency-Key': crypto.randomUUID() },
    }),
  )
}

/**
 * Re-plan: the new trip is cached as it comes back, so its page opens at
 * once, and it goes to the top of the recent trips like any new plan.
 */
export function useReplanTrip() {
  const queryClient = useQueryClient()
  return useMutation<Trip, ApiError, string>({
    mutationFn: replanTrip,
    onSuccess: (trip) => {
      queryClient.setQueryData(tripKeys.detail(trip.trip_id), trip)
      addPlannedTrip(queryClient, trip)
    },
  })
}

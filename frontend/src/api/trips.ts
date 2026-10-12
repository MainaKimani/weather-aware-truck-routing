/**
 * Saved trips (RFC §7.4). Every plan is a trip; its page reads it back
 * exactly as it was planned.
 *
 * Keys start with ['trips', id] like the heatmap's, so a trip's queries can
 * be found together.
 */
import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'
import type { ApiError } from './errors'
import type { Trip } from './schema'

export const tripKeys = {
  all: ['trips'] as const,
  detail: (tripId: string) => ['trips', tripId, 'detail'] as const,
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

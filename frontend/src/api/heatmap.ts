/**
 * The corridor heatmap for the trip on screen (RFC §7.3). It is requested
 * as soon as a plan arrives (`usePlanTrip` prefetches it), never before, so
 * the routes appear first and the heatmap follows.
 *
 * The server computes it once and keeps it, so a trip's heatmap never
 * changes and is never refetched.
 */
import { queryOptions, skipToken, useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'

export const heatmapKeys = {
  trip: (tripId: string) => ['trips', tripId, 'heatmap'] as const,
}

export function fetchHeatmap(tripId: string, signal?: AbortSignal) {
  return unwrap(
    api.GET('/api/v1/trips/{trip_id}/heatmap', { params: { path: { trip_id: tripId } }, signal }),
  )
}

export function heatmapQuery(tripId: string | undefined) {
  return queryOptions({
    queryKey: heatmapKeys.trip(tripId ?? ''),
    queryFn: tripId ? ({ signal }) => fetchHeatmap(tripId, signal) : skipToken,
    staleTime: Infinity,
  })
}

/** A trip's heatmap; idle while there is no trip. */
export function useHeatmap(tripId: string | undefined) {
  return useQuery(heatmapQuery(tripId))
}

/**
 * The corridor heatmap for the trip on screen (RFC §7.3). It is requested
 * as soon as a plan arrives (`usePlanTrip` prefetches it), never before, so
 * the routes appear first and the heatmap follows.
 *
 * The server computes it once and keeps it, so a trip's heatmap never
 * changes and is never refetched. With `metrics` (each condition's levels,
 * for the metric switcher) it is a separate, larger request, made only when
 * a condition is first chosen; it carries the risk grid too.
 */
import { queryOptions, skipToken, useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'

export const heatmapKeys = {
  trip: (tripId: string, metrics = false) => ['trips', tripId, 'heatmap', { metrics }] as const,
}

export function fetchHeatmap(tripId: string, metrics: boolean, signal?: AbortSignal) {
  return unwrap(
    api.GET('/api/v1/trips/{trip_id}/heatmap', {
      params: {
        path: { trip_id: tripId },
        query: metrics ? { include: 'metrics' } : undefined,
      },
      signal,
    }),
  )
}

interface HeatmapQuery {
  /** Include each condition's levels. */
  metrics?: boolean
  /** False: only read what is already cached, never request it. */
  enabled?: boolean
}

export function heatmapQuery(
  tripId: string | undefined,
  { metrics = false, enabled = true }: HeatmapQuery = {},
) {
  return queryOptions({
    queryKey: heatmapKeys.trip(tripId ?? '', metrics),
    queryFn: tripId && enabled ? ({ signal }) => fetchHeatmap(tripId, metrics, signal) : skipToken,
    staleTime: Infinity,
  })
}

/** A trip's heatmap; idle while there is no trip. */
export function useHeatmap(tripId: string | undefined, options?: HeatmapQuery) {
  return useQuery(heatmapQuery(tripId, options))
}

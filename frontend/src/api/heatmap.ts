/**
 * The corridor heatmap for the trip on screen (RFC §7.3). It is requested
 * as soon as a plan arrives (`usePlanTrip` prefetches it), never before, so
 * the routes appear first and the heatmap follows.
 *
 * The server computes it once and keeps it, so a trip's heatmap never
 * changes and is never refetched. With `metrics` (each condition's levels,
 * for the metric switcher) it is a separate, larger request, made only when
 * a condition is first chosen; it carries the risk grid too.
 *
 * When the weather service is busy (weather_busy) the server keeps what it
 * fetched, so the request is retried a few times, each after its Retry-After
 * (`retryDelay` in queryClient.ts), and completes from there. Longer waits
 * (the hour's or day's allowance) give up.
 */
import { queryOptions, skipToken, useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'
import { ApiError } from './errors'
import { shouldRetry } from './queryClient'

const BUSY_RETRIES = 3
const BUSY_WAIT_LIMIT_S = 120

function isBusy(error: Error): error is ApiError {
  return error instanceof ApiError && error.code === 'weather_busy'
}

/** The usual single retry, or up to three after Retry-After while the weather is busy. */
function retry(failures: number, error: Error): boolean {
  if (!isBusy(error)) return shouldRetry(failures, error)
  return failures < BUSY_RETRIES && (error.retryAfterS ?? 0) <= BUSY_WAIT_LIMIT_S
}

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
    retry,
  })
}

/** A trip's heatmap; idle while there is no trip. */
export function useHeatmap(tripId: string | undefined, options?: HeatmapQuery) {
  return useQuery(heatmapQuery(tripId, options))
}

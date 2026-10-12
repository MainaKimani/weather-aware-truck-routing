import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'
import type { Place } from './schema'

export const MIN_QUERY = 2
const DAY_MS = 24 * 60 * 60 * 1000

/** Same normalisation as the backend, so "Dallas" and " dallas " share a cache entry. */
export function normaliseQuery(query: string): string {
  return query.split(/\s+/).filter(Boolean).join(' ').toLowerCase()
}

export const placeKeys = {
  suggest: (query: string) => ['places', 'suggest', normaliseQuery(query)] as const,
}

/**
 * Place suggestions for a partial name. Debouncing the input is the
 * caller's job; this hook caches by query for a day, skips queries under
 * two characters, cancels superseded requests, and keeps showing the last
 * results while the next ones load.
 */
export function usePlaceSuggestions(query: string) {
  const q = normaliseQuery(query)
  return useQuery<Place[]>({
    queryKey: placeKeys.suggest(q),
    queryFn: ({ signal }) =>
      unwrap(api.GET('/api/v1/geocode/suggest', { params: { query: { q } }, signal })),
    enabled: q.length >= MIN_QUERY,
    staleTime: DAY_MS,
    placeholderData: keepPreviousData,
  })
}

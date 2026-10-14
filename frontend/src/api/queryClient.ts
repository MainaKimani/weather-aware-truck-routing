import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './errors'

/** Retry once, and only when the same request could succeed: never 4xx, 422 or 429. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof ApiError && error.transient
}

/** Retry-After when the server sent one (a busy weather service); otherwise React Query's back-off. */
export function retryDelay(failureCount: number, error: unknown): number {
  if (error instanceof ApiError && error.code === 'weather_busy' && error.retryAfterS !== null) {
    return error.retryAfterS * 1000
  }
  return Math.min(1000 * 2 ** failureCount, 30_000)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay,
        // Forecasts change hourly and plans are snapshots: refetching on focus adds load, not truth.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: shouldRetry },
    },
  })
}

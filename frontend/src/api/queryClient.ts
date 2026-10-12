import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './errors'

/** Retry once, and only when the same request could succeed: never 4xx, 422 or 429. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof ApiError && error.transient
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        // Forecasts change hourly and plans are snapshots: refetching on focus adds load, not truth.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: shouldRetry },
    },
  })
}

import { useEffect, useState } from 'react'

import type { ApiError } from '../../api/errors'
import { failureCopy } from './failureCopy'

interface PlanFailureProps {
  error: ApiError
  onRetry: () => void
  retrying: boolean
}

/**
 * Why the plan failed and what to do, with a retry (held back while rate
 * limited, and left out when the month's routing allowance is spent).
 */
export function PlanFailure({ error, onRetry, retrying }: PlanFailureProps) {
  const { title, detail } = failureCopy(error)
  const wait = useCountdown(error.code === 'rate_limited' ? (error.retryAfterS ?? 60) : 0, error)

  return (
    <div role="alert" className="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm">
      <p className="font-semibold text-danger">{title}</p>
      <p className="mt-1">{detail}</p>
      {error.requestId && (
        <p className="mt-1 text-xs text-muted">
          If it keeps happening, quote request <span className="font-mono">{error.requestId}</span>.
        </p>
      )}
      {error.code !== 'quota_reached' && (
        <button
          type="button"
          onClick={onRetry}
          disabled={retrying || wait > 0}
          className="mt-2 rounded-md border border-line bg-surface px-2.5 py-1 font-medium hover:bg-surface-raised disabled:opacity-60"
        >
          {wait > 0 ? `Try again in ${String(wait)} s` : 'Try again'}
        </button>
      )}
    </div>
  )
}

/** Seconds left of `seconds`, ticking down once a second; restarts for a new `key`. */
function useCountdown(seconds: number, key: unknown): number {
  const [left, setLeft] = useState(seconds)
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setLeft(seconds)
  }
  useEffect(() => {
    if (left <= 0) return
    const timer = setTimeout(() => {
      setLeft((n) => n - 1)
    }, 1000)
    return () => {
      clearTimeout(timer)
    }
  }, [left])
  return left
}

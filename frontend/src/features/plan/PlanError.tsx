import type { ApiError } from '../../api/errors'

/** The failure of the last plan request, with its request id for support. */
export function PlanError({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm">
      <p className="font-medium text-danger">{error.message}</p>
      {error.requestId && (
        <p className="mt-1 font-mono text-xs text-muted">Request {error.requestId}</p>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-md border border-line px-2.5 py-1 font-medium hover:bg-surface-raised"
      >
        Try again
      </button>
    </div>
  )
}

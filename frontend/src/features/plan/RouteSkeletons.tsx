/** Placeholder cards while the plan is computed; announced once to screen readers. */
export function RouteSkeletons() {
  return (
    <div aria-busy="true" className="space-y-2">
      <p role="status" className="text-sm text-muted">
        Evaluating weather along each route…
      </p>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="animate-pulse rounded-card border border-line p-3"
        >
          <div className="h-4 w-2/5 rounded bg-line" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-3 rounded bg-line" />
            <div className="h-3 rounded bg-line" />
            <div className="h-3 rounded bg-line" />
            <div className="h-3 rounded bg-line" />
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-line" />
        </div>
      ))}
    </div>
  )
}

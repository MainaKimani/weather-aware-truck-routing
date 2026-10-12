import { usePlanTrip } from '../../api/plans'
import { demoTripRequest } from './demoTrip'
import { PlanError } from './PlanError'

/** Plans the Dallas → Denver walkthrough trip until the trip form exists. */
export function DemoTrip() {
  const { plan, isPending, error } = usePlanTrip()
  const run = () => {
    plan(demoTripRequest())
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={run}
        disabled={isPending}
        aria-busy={isPending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? 'Evaluating weather corridors…' : 'Plan the demo trip: Dallas → Denver'}
      </button>
      {error && <PlanError error={error} onRetry={run} />}
    </div>
  )
}

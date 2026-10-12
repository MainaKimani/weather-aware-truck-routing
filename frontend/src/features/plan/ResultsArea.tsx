/**
 * Everything below the form, by state (PRD §9, RFC §11): nothing before the
 * first plan, skeletons while planning, the failure with a retry, and the
 * results. A failure after an earlier plan keeps that plan on screen, dimmed
 * and labelled, so stale results are never mistaken for the new trip.
 */
import { useLatestPlanAttempt, usePlan, usePlanTrip } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { CheckpointTable } from '../checkpoints/CheckpointTable'
import { RoutesPanel } from '../routes-panel/RoutesPanel'
import { PlanFailure } from './PlanFailure'
import { RouteSkeletons } from './RouteSkeletons'

const hasPlan = (plan: Plan) => plan.routes.length > 0

export function ResultsArea() {
  const attempt = useLatestPlanAttempt()
  const planned = usePlan(hasPlan) ?? false
  const { plan, isPending } = usePlanTrip()

  if (attempt.status === 'pending') return <RouteSkeletons />

  // Field errors are shown on the form itself.
  const failure =
    attempt.status === 'error' && attempt.error?.code !== 'invalid_input' ? attempt.error : null
  const retry = () => {
    if (attempt.request) plan(attempt.request)
  }

  return (
    <div className="space-y-5">
      {failure && <PlanFailure error={failure} onRetry={retry} retrying={isPending} />}
      {planned && (
        <div className={failure ? 'opacity-50' : undefined}>
          {failure && (
            <p className="mb-2 text-xs font-medium text-muted">
              Showing your previous plan, not the trip that just failed.
            </p>
          )}
          <div className="space-y-5">
            <RoutesPanel />
            <CheckpointTable />
          </div>
        </div>
      )}
    </div>
  )
}

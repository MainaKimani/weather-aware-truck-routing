import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'

const isDemo = (plan: Plan) => plan.demo

/** Says so when the plan on screen came from the scripted demo providers (RFC §13). */
export function DemoBadge() {
  if (!usePlan(isDemo)) return null
  return (
    <span className="rounded-full border border-line bg-surface-raised px-2 py-0.5 text-xs font-medium text-muted">
      Demo data
    </span>
  )
}

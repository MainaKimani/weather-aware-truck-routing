/**
 * The instant slider hour 0 shows for the plan on screen (see clock.ts), so
 * the slider and everything placed by its hour agree on what each hour is.
 */
import { useHeatmap } from '../../api/heatmap'
import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { timelineStart } from './clock'

const selectTripId = (plan: Plan) => plan.trip_id
const selectGeneratedAt = (plan: Plan) => plan.generated_at

export function useTimelineStart(): string | null {
  const { data: heatmap } = useHeatmap(usePlan(selectTripId))
  return timelineStart(heatmap?.start_hour, usePlan(selectGeneratedAt))
}

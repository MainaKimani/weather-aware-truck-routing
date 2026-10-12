/** Stable plan selectors for the routes panel (module-level, so subscriptions stay narrow). */
import type { Plan } from '../../api/schema'
import { formatMiles } from '../../lib/format'
import { RISK, RISK_LEVELS, type RiskBucket } from '../../lib/risk'
import { browserZone } from '../../lib/time'

export type PlanRoute = Plan['routes'][number]

export const selectRoutes = (plan: Plan) => plan.routes

export interface PlanContext {
  recommendedId: string | null
  reason: string
  reasonCode: Plan['reason_code']
  originZone: string
  destinationZone: string
  hosEnabled: boolean
}

export const selectContext = (plan: Plan): PlanContext => {
  const originZone = plan.inputs.origin.tz ?? browserZone()
  return {
    recommendedId: plan.recommended_route_id,
    reason: plan.recommendation_reason,
    reasonCode: plan.reason_code,
    originZone,
    destinationZone: plan.inputs.destination.tz ?? originZone,
    hosEnabled: plan.settings.hos_enabled,
  }
}

export interface PlanNoticesData {
  stale: boolean
  forecastAsOf: string | null
  noDrivableRoute: boolean
  hosEnabled: boolean
  warnings: { code: string; message: string; routeName: string | null }[]
}

export const selectNotices = (plan: Plan): PlanNoticesData => ({
  stale: plan.stale,
  forecastAsOf: plan.forecast_as_of,
  noDrivableRoute: plan.recommended_route_id === null,
  hosEnabled: plan.settings.hos_enabled,
  warnings: plan.warnings.map((w) => ({
    code: w.code,
    message: w.message,
    routeName: w.route_id ? (plan.routes.find((r) => r.id === w.route_id)?.name ?? null) : null,
  })),
})

const BUCKETS: readonly RiskBucket[] = [...RISK_LEVELS, 'UNKNOWN']

/** "655 mi Low · 75 mi Moderate · 100 mi Severe": levels with at least half a mile. */
export function milesByLevelText(route: PlanRoute): string {
  return BUCKETS.filter((b) => route.metrics.miles_by_level[b] >= 0.5)
    .map((b) => `${formatMiles(route.metrics.miles_by_level[b])} ${RISK[b].label}`)
    .join(' · ')
}

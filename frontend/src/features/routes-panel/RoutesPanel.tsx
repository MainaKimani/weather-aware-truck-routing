/**
 * The ranked routes. A placeholder list for now; the full cards (risk bar,
 * HOS summary, warnings) come with the route-card work.
 */
import { memo } from 'react'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { riskStyle } from '../../lib/risk'
import { useUiStore } from '../../state/ui'

function summarise(plan: Plan) {
  return {
    reason: plan.recommendation_reason,
    recommendedId: plan.recommended_route_id,
    routes: plan.routes.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      distanceMi: r.distance_mi,
      worst: r.metrics.worst,
      drivable: r.metrics.drivable,
    })),
  }
}

export function RoutesPanel() {
  const summary = usePlan(summarise)
  if (!summary) return null

  return (
    <section aria-labelledby="routes-title" className="space-y-3">
      <div>
        <h2 id="routes-title" className="text-sm font-semibold">
          Routes
        </h2>
        <p className="mt-1 text-sm text-muted">{summary.reason}</p>
      </div>
      <ol className="space-y-2">
        {summary.routes.map((route) => (
          <RouteItem key={route.id} {...route} recommended={route.id === summary.recommendedId} />
        ))}
      </ol>
    </section>
  )
}

interface RouteItemProps {
  id: string
  name: string
  label: string | null
  distanceMi: number
  worst: Plan['routes'][number]['metrics']['worst']
  drivable: boolean
  recommended: boolean
}

const RouteItem = memo(function RouteItem(props: RouteItemProps) {
  const { id, name, label, distanceMi, worst, drivable, recommended } = props
  const selected = useUiStore((s) => s.selectedRouteId === id)
  const selectRoute = useUiStore((s) => s.selectRoute)
  const risk = riskStyle(worst)

  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => {
          selectRoute(id)
        }}
        className="w-full rounded-card border border-line p-3 text-left hover:bg-surface-raised aria-pressed:border-accent aria-pressed:ring-1 aria-pressed:ring-accent"
      >
        <span className="flex items-center gap-2">
          <span className="font-semibold">{name}</span>
          {label && <span className="text-sm text-muted">· {label}</span>}
          {recommended && (
            <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">
              Recommended
            </span>
          )}
          {!drivable && (
            <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-accent-ink">
              Not drivable
            </span>
          )}
        </span>
        <span className="mt-1.5 flex items-center gap-2 text-sm text-muted">
          <span className="tabular">{distanceMi.toFixed(0)} mi</span>
          <span
            className="rounded px-1.5 py-0.5 text-xs font-medium"
            style={{ backgroundColor: risk.color, color: risk.ink }}
          >
            Worst: {risk.label}
          </span>
        </span>
      </button>
    </li>
  )
})

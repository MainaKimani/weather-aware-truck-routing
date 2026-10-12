/**
 * The route's risk along its length: each checkpoint's owned miles, in order,
 * in its level's colour (design review fix 2). Screen readers get the miles
 * by level as text.
 */
import { formatMiles } from '../../lib/format'
import { riskStyle } from '../../lib/risk'
import { milesByLevelText, type PlanRoute } from './selectors'

export function RiskStrip({ route }: { route: PlanRoute }) {
  const total = route.distance_mi
  const summary = milesByLevelText(route)
  return (
    <div>
      <div
        role="img"
        aria-label={`Risk along the route: ${summary}`}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-line"
      >
        {route.checkpoints.map((cp) => {
          const style = riskStyle(cp.risk.level)
          const from = Math.max(0, cp.mile - cp.owned_mi / 2)
          return (
            <span
              key={cp.mile}
              title={`mi ${formatMiles(from).replace(' mi', '')}–${formatMiles(from + cp.owned_mi)}: ${style.label}`}
              style={{
                width: `${String((cp.owned_mi / total) * 100)}%`,
                backgroundColor: style.color,
              }}
            />
          )
        })}
      </div>
      <p className="tabular mt-1 text-xs text-muted">{summary}</p>
    </div>
  )
}

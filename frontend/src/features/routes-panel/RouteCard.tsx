/**
 * One ranked route. Subscribes only to its own selection and hover state, so
 * selecting another route re-renders the two cards that change, nothing else.
 *
 * A click anywhere on the card selects the route, which the map follows. The
 * title row is the card's button, for the keyboard and screen readers.
 */
import { memo } from 'react'

import { formatAvgRisk, formatClockTime, formatDuration, formatMiles } from '../../lib/format'
import { riskStyle } from '../../lib/risk'
import { useUiStore } from '../../state/ui'
import { HosSummary } from './HosSummary'
import { RiskStrip } from './RiskStrip'
import type { PlanContext, PlanRoute } from './selectors'

interface RouteCardProps {
  route: PlanRoute
  context: PlanContext
}

export const RouteCard = memo(function RouteCard({ route, context }: RouteCardProps) {
  const selected = useUiStore((s) => s.selectedRouteId === route.id)
  const hovered = useUiStore((s) => s.hoveredRouteId === route.id)
  const selectRoute = useUiStore((s) => s.selectRoute)
  const hoverRoute = useUiStore((s) => s.hoverRoute)
  const recommended = route.id === context.recommendedId
  const worst = riskStyle(route.metrics.worst)
  const titleId = `route-${route.id}-title`

  return (
    <li
      aria-labelledby={titleId}
      // The button inside is the keyboard's way in; this widens the mouse target.
      onClick={() => {
        selectRoute(route.id)
      }}
      onMouseEnter={() => {
        hoverRoute(route.id)
      }}
      onMouseLeave={() => {
        hoverRoute(null)
      }}
      className={`cursor-pointer rounded-card border bg-surface p-3 transition-colors ${
        selected
          ? 'border-accent ring-1 ring-accent'
          : hovered
            ? 'border-muted bg-surface-raised'
            : 'border-line'
      }`}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-describedby={`route-${route.id}-stats`}
        onClick={() => {
          selectRoute(route.id)
        }}
        onFocus={() => {
          hoverRoute(route.id)
        }}
        onBlur={() => {
          hoverRoute(null)
        }}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left"
      >
        <span id={titleId} className="font-semibold">
          {route.name}
          {route.label && <span className="font-normal text-muted"> · {route.label}</span>}
        </span>
        <span className="ml-auto flex gap-1.5">
          {recommended && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-ink">
              Recommended
            </span>
          )}
          {!route.metrics.drivable && (
            <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-accent-ink">
              Not drivable
            </span>
          )}
        </span>
      </button>

      {recommended && <p className="mt-1 text-sm">{context.reason}</p>}

      <dl
        id={`route-${route.id}-stats`}
        className="tabular mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm"
      >
        <Stat label="Distance" value={formatMiles(route.distance_mi)} />
        <Stat label="Drive time" value={formatDuration(route.duration_s)} />
        <Stat label="Arrives" value={formatClockTime(route.arrival, context.destinationZone)} />
        <Stat label="Average risk" value={formatAvgRisk(route.metrics.avg_risk)} />
        <div className="col-span-2 flex items-center gap-2">
          <dt className="text-muted">Worst</dt>
          <dd>
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium"
              style={{ backgroundColor: worst.color, color: worst.ink }}
            >
              {worst.label}
            </span>
            {route.metrics.worst_at_mile !== null && route.metrics.worst !== 'LOW' && (
              <span className="text-muted"> at mi {Math.round(route.metrics.worst_at_mile)}</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-2.5">
        <RiskStrip route={route} />
      </div>

      {context.hosEnabled && (
        <div className="mt-2">
          <HosSummary route={route} zone={context.originZone} />
        </div>
      )}
    </li>
  )
})

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}

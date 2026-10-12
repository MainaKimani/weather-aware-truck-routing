/** Plan-wide notices above the route cards: no safe route, stale forecast, HOS, warnings. */
import { usePlan } from '../../api/plans'
import { formatAge } from '../../lib/format'
import { selectNotices } from './selectors'

export function PlanNotices() {
  const notices = usePlan(selectNotices)
  if (!notices) return null
  return (
    <div className="space-y-2">
      {notices.noDrivableRoute && (
        <div role="alert" className="rounded-card border border-danger/40 bg-danger/10 p-3 text-sm">
          <p className="font-semibold text-danger">No safe route right now</p>
          <p className="mt-0.5">
            Every route has No travel conditions. The routes are still ranked below; try a later
            departure.
          </p>
        </div>
      )}
      {notices.stale && (
        <p
          role="status"
          className="rounded-card border border-line bg-surface-raised p-2.5 text-sm"
        >
          Weather service unavailable: showing the forecast from{' '}
          {notices.forecastAsOf ? formatAge(notices.forecastAsOf) : 'earlier'}.
        </p>
      )}
      {notices.warnings.length > 0 && (
        <ul className="space-y-1 rounded-card border border-line bg-surface-raised p-2.5 text-sm">
          {notices.warnings.map((w) => (
            <li key={`${w.code}-${w.routeName ?? ''}`}>
              {w.routeName && <span className="font-medium">{w.routeName}: </span>}
              {w.message}
            </li>
          ))}
        </ul>
      )}
      {notices.hosEnabled && (
        <p className="text-xs text-muted">ETAs include Hours of Service stops.</p>
      )}
    </div>
  )
}

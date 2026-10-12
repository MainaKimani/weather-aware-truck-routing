import { formatClockTime, formatDuration, formatMiles, formatStopLength } from '../../lib/format'
import { STOP_KIND_LABEL, STOP_REASON_LABEL } from '../../lib/hosStops'
import type { PlanRoute } from './selectors'

function counted(n: number, word: string): string {
  return `${String(n)} ${word}${n === 1 ? '' : 's'}`
}

/** "Trip 22 h 14 min (incl. 1 break, 1 rest)" and the stops, when Hours of Service is on. */
export function HosSummary({ route, zone }: { route: PlanRoute; zone: string }) {
  const stops = route.hos_stops
  const parts = (['break', 'rest', 'restart'] as const)
    .map((kind) => [kind, stops.filter((s) => s.kind === kind).length] as const)
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => counted(n, kind))
  return (
    <details className="text-sm">
      <summary className="tabular cursor-pointer">
        Trip {formatDuration(route.trip_duration_s)}
        {parts.length > 0 ? ` (incl. ${parts.join(', ')})` : ' (no stops needed)'}
      </summary>
      {stops.length > 0 && (
        <ol className="mt-1.5 space-y-1 text-xs text-muted">
          {stops.map((stop) => (
            <li key={`${stop.kind}-${String(stop.mile)}`} className="tabular">
              <span className="font-medium text-ink">
                {STOP_KIND_LABEL[stop.kind]} {formatStopLength(stop.duration_s)}
              </span>{' '}
              at {formatMiles(stop.mile).replace(' mi', '')} mi, {formatClockTime(stop.start, zone)}{' '}
              ({STOP_REASON_LABEL[stop.reason]})
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}

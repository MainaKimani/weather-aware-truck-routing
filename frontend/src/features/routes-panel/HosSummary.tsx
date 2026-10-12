import { formatClockTime, formatDuration, formatMiles, formatStopLength } from '../../lib/format'
import type { PlanRoute } from './selectors'

const KIND_LABEL = { break: 'Break', rest: 'Rest', restart: 'Restart' } as const
const REASON_LABEL = {
  break: '8 h driving',
  drive_limit: '11 h driving limit',
  window: '14 h shift window',
  cycle: 'weekly cycle',
} as const

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
                {KIND_LABEL[stop.kind]} {formatStopLength(stop.duration_s)}
              </span>{' '}
              at {formatMiles(stop.mile).replace(' mi', '')} mi, {formatClockTime(stop.start, zone)}{' '}
              ({REASON_LABEL[stop.reason]})
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}

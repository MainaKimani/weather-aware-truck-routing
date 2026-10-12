import type { TripSummary } from '../../api/schema'
import { formatDateTime } from '../../lib/format'
import { browserZone } from '../../lib/time'
import { RiskChip } from './RiskChip'
import { tripTitle } from './tripLabels'

/** A trip in a list: its name or route, when it leaves with what load, and its pick's worst. */
export function TripSummaryLine({ trip }: { trip: TripSummary }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate font-medium">{tripTitle(trip)}</span>
      <span className="tabular mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>
          {formatDateTime(trip.departure, browserZone())} · {trip.load_lb.toLocaleString('en-US')}{' '}
          lb
        </span>
        {trip.recommended ? (
          <span className="flex items-center gap-1">
            {trip.recommended.name}, worst <RiskChip level={trip.recommended.worst} />
          </span>
        ) : (
          <span>No drivable route</span>
        )}
      </span>
    </span>
  )
}

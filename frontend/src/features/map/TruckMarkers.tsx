/**
 * Where each route's truck is at the slider's hour (RFC §10.4), so scrubbing
 * shows the weather the truck meets rather than the weather somewhere along
 * the line. The selected route's truck is full size; the others are small
 * and follow the "Other routes" switch. A truck is hidden before it leaves
 * and after it arrives, and stands still through its HOS stops.
 *
 * Markers rather than a layer: three of them, moved by props, cost nothing
 * and upload no data.
 */
import { useMemo } from 'react'
import { Marker } from 'react-map-gl/maplibre'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { formatMiles } from '../../lib/format'
import { useTimelineStore } from '../../state/timeline'
import { useUiStore } from '../../state/ui'
import { useTimelineStart } from '../timeline/useTimelineStart'
import { buildTruckTrack, truckAt } from './truckTrack'

const HOUR_MS = 3600_000

const selectRoutes = (plan: Plan) => plan.routes

export function TruckMarkers() {
  const routes = usePlan(selectRoutes)
  const tracks = useMemo(
    () => routes?.map((route) => ({ route, track: buildTruckTrack(route) })) ?? [],
    [routes],
  )
  const start = useTimelineStart()
  const hour = useTimelineStore((s) => s.hour)
  const selected = useUiStore((s) => s.selectedRouteId)
  const showOthers = useUiStore((s) => s.layers.alternatives)
  if (!start) return null
  const at = Date.parse(start) + hour * HOUR_MS

  return tracks.map(({ route, track }) => {
    const isSelected = route.id === selected
    if (!isSelected && !showOthers) return null
    const truck = truckAt(track, at)
    if (!truck) return null
    const where = `${truck.stopped ? 'stopped at' : 'at'} ${formatMiles(truck.mile)}`
    return (
      <Marker key={route.id} longitude={truck.lon} latitude={truck.lat} anchor="center">
        <span
          role="img"
          aria-label={`${route.name} truck, ${where}`}
          title={`${route.name} truck, ${where}`}
          className={[
            'pointer-events-none grid place-items-center rounded-full border-2 border-surface shadow-overlay',
            isSelected ? 'size-7 bg-ink text-surface' : 'size-5 bg-muted text-surface',
            truck.stopped ? 'opacity-70' : '',
          ].join(' ')}
        >
          <TruckIcon />
        </span>
      </Marker>
    )
  })
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3/5 fill-current">
      <path d="M1 4h8v6H1zM10 6h3l2 2.5V10h-5z" />
      <circle cx="4" cy="11.5" r="1.5" />
      <circle cx="12" cy="11.5" r="1.5" />
    </svg>
  )
}

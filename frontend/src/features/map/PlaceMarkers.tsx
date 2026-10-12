import { Marker } from 'react-map-gl/maplibre'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { PIN_HEIGHT } from './basemap'

const selectEnds = (plan: Plan) => ({
  origin: plan.inputs.origin,
  destination: plan.inputs.destination,
})

/** Origin and destination pins for the plan on screen. */
export function PlaceMarkers() {
  const ends = usePlan(selectEnds)
  if (!ends) return null
  return (
    <>
      <Marker longitude={ends.origin.lon} latitude={ends.origin.lat} anchor="center">
        <span
          role="img"
          aria-label={`Origin: ${ends.origin.label}`}
          title={ends.origin.label}
          className="block size-4 rounded-full border-[3px] border-ink bg-surface shadow-overlay"
        />
      </Marker>
      <Marker longitude={ends.destination.lon} latitude={ends.destination.lat} anchor="bottom">
        <svg
          role="img"
          aria-label={`Destination: ${ends.destination.label}`}
          viewBox="0 0 24 32"
          width={(PIN_HEIGHT * 3) / 4}
          height={PIN_HEIGHT}
          className="drop-shadow"
        >
          <title>{ends.destination.label}</title>
          <path
            d="M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z"
            className="fill-ink"
          />
          <circle cx="12" cy="12" r="4.5" className="fill-surface" />
        </svg>
      </Marker>
    </>
  )
}

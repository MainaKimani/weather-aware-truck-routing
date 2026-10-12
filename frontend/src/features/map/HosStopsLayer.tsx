/**
 * Hours of Service stops on the selected route (RFC §10.3, layer 5), only
 * when HOS is on: an icon per stop (break, rest, restart) at the API's
 * coordinates, and a popup with when it starts, how long it lasts and why.
 *
 * Drawn as markers rather than a symbol layer: a route has a handful of
 * stops, so the cost is nothing, and each stop is a real button that can be
 * reached and opened from the keyboard.
 */
import { useCallback, useState } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'

import { usePlan } from '../../api/plans'
import type { HosStop, HosStopKindEnum, Plan } from '../../api/schema'
import { formatClockTime, formatMiles, formatStopLength } from '../../lib/format'
import { STOP_KIND_LABEL, STOP_REASON_LABEL } from '../../lib/hosStops'
import { browserZone } from '../../lib/time'
import { useUiStore } from '../../state/ui'

interface Stops {
  routeId: string
  stops: readonly HosStop[]
  zone: string
}

export function HosStopsLayer() {
  const routeId = useUiStore((s) => s.selectedRouteId)
  const select = useCallback(
    (plan: Plan): Stops | null => {
      const route = plan.routes.find((r) => r.id === routeId)
      if (!plan.settings.hos_enabled || !route || route.hos_stops.length === 0) return null
      return {
        routeId: route.id,
        stops: route.hos_stops,
        zone: plan.inputs.origin.tz ?? browserZone(),
      }
    },
    [routeId],
  )
  const data = usePlan(select)
  // Keyed by route, so a popup never outlives the route it belongs to.
  return data ? <Stops key={data.routeId} {...data} /> : null
}

function Stops({ stops, zone }: Stops) {
  const [open, setOpen] = useState<number | null>(null)
  const stop = open === null ? undefined : stops[open]

  return (
    <>
      {stops.map((s, i) => (
        <Marker key={`${s.kind}-${String(s.mile)}`} longitude={s.lon} latitude={s.lat}>
          <button
            type="button"
            aria-label={`${STOP_KIND_LABEL[s.kind]} ${formatStopLength(s.duration_s)}, ${formatClockTime(s.start, zone)}`}
            aria-expanded={open === i}
            onClick={(e) => {
              // The map would read this as a click on empty map.
              e.stopPropagation()
              setOpen(open === i ? null : i)
            }}
            className="grid size-7 cursor-pointer place-items-center rounded-full border-2 border-surface bg-ink text-surface shadow-overlay"
          >
            <StopIcon kind={s.kind} />
          </button>
        </Marker>
      ))}
      {stop && (
        <Popup
          longitude={stop.lon}
          latitude={stop.lat}
          offset={18}
          closeOnClick={false}
          focusAfterOpen={false}
          onClose={() => {
            setOpen(null)
          }}
        >
          <section aria-label={`${STOP_KIND_LABEL[stop.kind]} stop`} className="text-xs">
            <h3 className="pr-5 font-semibold">
              {STOP_KIND_LABEL[stop.kind]} {formatStopLength(stop.duration_s)}
            </h3>
            <dl className="tabular mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              <dt className="text-muted">Starts</dt>
              <dd>{formatClockTime(stop.start, zone)}</dd>
              <dt className="text-muted">Ends</dt>
              <dd>
                {formatClockTime(
                  new Date(Date.parse(stop.start) + stop.duration_s * 1000).toISOString(),
                  zone,
                )}
              </dd>
              <dt className="text-muted">Where</dt>
              <dd>{formatMiles(stop.mile)} in</dd>
              <dt className="text-muted">Why</dt>
              <dd>{STOP_REASON_LABEL[stop.reason]}</dd>
            </dl>
          </section>
        </Popup>
      )}
    </>
  )
}

/** Pause bars for a break, a moon for a rest, a circular arrow for a restart. */
function StopIcon({ kind }: { kind: HosStopKindEnum }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5 fill-current">
      {kind === 'break' && (
        <>
          <rect x="3.5" y="3" width="3" height="10" rx="1" />
          <rect x="9.5" y="3" width="3" height="10" rx="1" />
        </>
      )}
      {kind === 'rest' && <path d="M10.5 2a6 6 0 1 0 3.5 10.6A6.5 6.5 0 0 1 10.5 2z" />}
      {kind === 'restart' && (
        <path d="M8 2.5a5.5 5.5 0 1 0 5.2 7.3l-1.9-.6A3.5 3.5 0 1 1 8 4.5c1 0 1.9.4 2.5 1.1L8.5 7.5H14V2l-2 2A5.5 5.5 0 0 0 8 2.5z" />
      )}
    </svg>
  )
}

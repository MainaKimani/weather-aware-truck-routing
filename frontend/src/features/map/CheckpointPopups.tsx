/**
 * What a checkpoint says on the map (RFC §10.3, layer 6): a small tooltip
 * for the hovered one and a popup with the details for the selected one.
 * Both follow `state/ui.ts`, so hovering or choosing a row in the checkpoint
 * table shows them too, and choosing a checkpoint off screen brings it into
 * view.
 */
import { useCallback, useEffect } from 'react'
import { Popup, useMap } from 'react-map-gl/maplibre'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { formatClockTime, formatValue } from '../../lib/format'
import { describeLoadRule } from '../../lib/loadRule'
import { prefersReducedMotion } from '../../lib/motion'
import { riskStyle } from '../../lib/risk'
import { browserZone } from '../../lib/time'
import { useUiStore, type CheckpointRef } from '../../state/ui'

type Checkpoint = Plan['routes'][number]['checkpoints'][number]

interface Detail {
  cp: Checkpoint
  routeName: string
  zone: string
  loadLb: number
}

const DRIVER = { wind: 'gusts', rain: 'rain', snow: 'snow' } as const

function useCheckpointDetail(ref: CheckpointRef | null): Detail | null {
  const routeId = ref?.routeId
  const index = ref?.index
  const select = useCallback(
    (plan: Plan): Detail | null => {
      const route = plan.routes.find((r) => r.id === routeId)
      const cp = index === undefined ? undefined : route?.checkpoints[index]
      if (!route || !cp) return null
      return {
        cp,
        routeName: route.name,
        zone: plan.inputs.origin.tz ?? browserZone(),
        loadLb: plan.inputs.load_lb,
      }
    },
    [routeId, index],
  )
  return usePlan(select) ?? null
}

const sameRef = (a: CheckpointRef | null, b: CheckpointRef | null) =>
  a?.routeId === b?.routeId && a?.index === b?.index

export function CheckpointPopups() {
  const hoveredRef = useUiStore((s) => s.hoveredCheckpoint)
  const selectedRef = useUiStore((s) => s.selectedCheckpoint)
  const selectCheckpoint = useUiStore((s) => s.selectCheckpoint)
  const hovered = useCheckpointDetail(hoveredRef)
  const selected = useCheckpointDetail(selectedRef)
  useBringIntoView(selected?.cp ?? null)

  return (
    <>
      {hovered && !sameRef(hoveredRef, selectedRef) && (
        <Popup
          longitude={hovered.cp.lon}
          latitude={hovered.cp.lat}
          offset={12}
          closeButton={false}
          closeOnClick={false}
          focusAfterOpen={false}
          className="checkpoint-tooltip"
        >
          <Tooltip detail={hovered} />
        </Popup>
      )}
      {selected && (
        <Popup
          longitude={selected.cp.lon}
          latitude={selected.cp.lat}
          offset={12}
          maxWidth="280px"
          closeOnClick={false}
          focusAfterOpen={false}
          onClose={() => {
            selectCheckpoint(null)
          }}
        >
          <Details detail={selected} />
        </Popup>
      )}
    </>
  )
}

function LevelChip({ cp }: { cp: Checkpoint }) {
  const risk = riskStyle(cp.risk.level)
  return (
    <span
      className="rounded px-1.5 py-px font-medium whitespace-nowrap"
      style={{ backgroundColor: risk.color, color: risk.ink }}
    >
      {risk.label}
    </span>
  )
}

function Tooltip({ detail: { cp, zone } }: { detail: Detail }) {
  return (
    <p className="flex items-center gap-1.5 text-xs whitespace-nowrap">
      <LevelChip cp={cp} />
      <span className="tabular">{formatClockTime(cp.eta, zone)}</span>
    </p>
  )
}

function Details({ detail: { cp, routeName, zone, loadLb } }: { detail: Detail }) {
  const f = cp.forecast
  const loadRule = describeLoadRule(cp.risk, f?.gust_mph, loadLb)
  return (
    <section aria-label={`Checkpoint at mile ${String(Math.round(cp.mile))}`} className="text-xs">
      <h3 className="pr-5 font-semibold">
        Mile {Math.round(cp.mile)} <span className="font-normal text-muted">· {routeName}</span>
      </h3>
      <dl className="tabular mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-muted">ETA</dt>
        <dd>{formatClockTime(cp.eta, zone)}</dd>
        <dt className="text-muted">Gust</dt>
        <dd>{formatValue(f?.gust_mph, 'mph')}</dd>
        <dt className="text-muted">Sustained</dt>
        <dd>
          {formatValue(f?.wind_mph, 'mph')} <span className="text-muted">(for info)</span>
        </dd>
        <dt className="text-muted">Rain</dt>
        <dd>{formatValue(f?.rain_in_hr, 'in/h', 2)}</dd>
        <dt className="text-muted">Snow</dt>
        <dd>{formatValue(f?.snow_in_hr, 'in/h', 1)}</dd>
        <dt className="text-muted">Risk</dt>
        <dd>
          <LevelChip cp={cp} />
          {cp.risk.driver && <span className="text-muted"> from {DRIVER[cp.risk.driver]}</span>}
        </dd>
      </dl>
      {loadRule && <p className="mt-1.5 leading-snug">{loadRule}</p>}
    </section>
  )
}

/** Eases the map to a newly selected checkpoint if it is off screen; leaves it alone otherwise. */
function useBringIntoView(cp: Checkpoint | null) {
  const { current: map } = useMap()
  const lon = cp?.lon
  const lat = cp?.lat
  useEffect(() => {
    if (!map || lon === undefined || lat === undefined) return
    if (map.getBounds().contains([lon, lat])) return
    map.easeTo({ center: [lon, lat], duration: prefersReducedMotion() ? 0 : 600 })
  }, [map, lon, lat])
}

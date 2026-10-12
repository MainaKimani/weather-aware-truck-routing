/**
 * The map legend and layer switches (RFC §10.6): the six risk levels, each
 * with its label so colour is never the only cue, what the heatmap colours
 * by, and switches for the heatmap, the checkpoints and the other routes.
 * Switching changes layer visibility only; nothing is reloaded.
 *
 * The heatmap can show the overall rating or one condition's level. Every
 * choice uses the same six levels and colours, so one key serves them all.
 */
import { useIsFetching, useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { heatmapKeys, heatmapQuery } from '../../api/heatmap'
import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { RISK, RISK_LEVELS, type RiskBucket } from '../../lib/risk'
import { useUiStore, type HeatmapMetric, type Layer } from '../../state/ui'

const BUCKETS: readonly RiskBucket[] = [...RISK_LEVELS, 'UNKNOWN']

const METRICS: readonly { metric: HeatmapMetric; label: string; note: string }[] = [
  { metric: 'risk', label: 'Risk', note: 'The overall rating, as on the checkpoints.' },
  { metric: 'wind', label: 'Wind', note: "Gusts, with this load's wind rules." },
  { metric: 'rain', label: 'Rain', note: 'Rain per hour.' },
  { metric: 'snow', label: 'Snow', note: 'Snowfall per hour.' },
]

const SWITCHES: readonly { layer: Layer; label: string }[] = [
  { layer: 'heatmap', label: 'Heatmap' },
  { layer: 'checkpoints', label: 'Checkpoints' },
  { layer: 'alternatives', label: 'Other routes' },
]

export function Legend() {
  const [open, setOpen] = useState(true)
  const id = useId()

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="absolute bottom-8 left-3 w-44 rounded-card border border-line bg-surface/95 text-xs shadow-overlay"
    >
      <h2 id={`${id}-title`}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => {
            setOpen(!open)
          }}
          className="flex w-full cursor-pointer items-center justify-between px-3 py-2 font-semibold"
        >
          Legend
          <span aria-hidden="true" className={open ? 'rotate-180 text-muted' : 'text-muted'}>
            ▾
          </span>
        </button>
      </h2>
      <div id={`${id}-body`} hidden={!open} className="space-y-2 px-3 pb-3">
        <ul aria-label="Risk levels" className="space-y-1">
          {BUCKETS.map((bucket) => (
            <li key={bucket} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-3 shrink-0 rounded-sm border border-line"
                style={{ backgroundColor: RISK[bucket].color }}
              />
              {RISK[bucket].label}
            </li>
          ))}
        </ul>
        <MetricChoice />
        <fieldset className="space-y-1 border-t border-line pt-2">
          <legend className="sr-only">Show on the map</legend>
          {SWITCHES.map(({ layer, label }) => (
            <LayerSwitch key={layer} layer={layer} label={label} />
          ))}
        </fieldset>
      </div>
    </section>
  )
}

function LayerSwitch({ layer, label }: { layer: Layer; label: string }) {
  const on = useUiStore((s) => s.layers[layer])
  const toggleLayer = useUiStore((s) => s.toggleLayer)
  return (
    <label className="flex min-h-6 cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={on}
        onChange={() => {
          toggleLayer(layer)
        }}
        className="accent-accent"
      />
      {label}
    </label>
  )
}

const selectTripId = (plan: Plan) => plan.trip_id

/** What the heatmap colours by; off while the heatmap is hidden. */
function MetricChoice() {
  const metric = useUiStore((s) => s.heatmapMetric)
  const showHeatmapMetric = useUiStore((s) => s.showHeatmapMetric)
  const heatmapOn = useUiStore((s) => s.layers.heatmap)
  const tripId = usePlan(selectTripId) ?? ''
  // Reads what the map's heatmap layer fetched; never requests anything itself.
  const { data: full } = useQuery(heatmapQuery(tripId, { metrics: true, enabled: false }))
  const loading = useIsFetching({ queryKey: heatmapKeys.trip(tripId, true) }) > 0
  const name = useId()
  const chosen = METRICS.find((m) => m.metric === metric) ?? METRICS[0]

  let status = chosen?.note
  if (metric !== 'risk' && loading) status = `Loading ${metric}…`
  else if (metric !== 'risk' && full && !full.metrics) {
    status = "Conditions aren't available for this trip; showing the overall rating."
  }

  return (
    <fieldset
      disabled={!heatmapOn}
      className="space-y-1 border-t border-line pt-2 disabled:opacity-60"
    >
      <legend className="font-semibold">Heatmap shows</legend>
      {/* Rows of at least 24 px, here and on the switches: big enough targets (WCAG 2.5.8). */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
        {METRICS.map((m) => (
          <label key={m.metric} className="flex min-h-6 cursor-pointer items-center gap-1.5">
            <input
              type="radio"
              name={name}
              checked={metric === m.metric}
              onChange={() => {
                showHeatmapMetric(m.metric)
              }}
              className="accent-accent"
            />
            {m.label}
          </label>
        ))}
      </div>
      <p aria-live="polite" className="text-muted">
        {status}
      </p>
    </fieldset>
  )
}

/**
 * The map legend and layer switches (RFC §10.6): the six risk levels, each
 * with its label so colour is never the only cue, and switches for the
 * checkpoints and the other routes. Switching changes layer visibility only;
 * nothing is reloaded.
 */
import { useId, useState } from 'react'

import { RISK, RISK_LEVELS, type RiskBucket } from '../../lib/risk'
import { useUiStore, type Layer } from '../../state/ui'

const BUCKETS: readonly RiskBucket[] = [...RISK_LEVELS, 'UNKNOWN']

const SWITCHES: readonly { layer: Layer; label: string }[] = [
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
    <label className="flex cursor-pointer items-center gap-2">
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

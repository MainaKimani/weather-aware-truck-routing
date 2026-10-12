/**
 * The forecast hour, 0-48 h from now. A minimal control for now; clock
 * labels, ticks and playback come with the heatmap timeline work.
 */
import { MAX_HOUR, useTimelineStore } from '../../state/timeline'

export function HourSlider() {
  const hour = useTimelineStore((s) => s.hour)
  const setHour = useTimelineStore((s) => s.setHour)

  return (
    <label className="flex h-12 items-center gap-3 px-4 text-sm">
      <span className="text-muted">Forecast</span>
      <input
        type="range"
        min={0}
        max={MAX_HOUR}
        step={1}
        value={hour}
        onChange={(e) => {
          setHour(e.currentTarget.valueAsNumber)
        }}
        aria-valuetext={`+${String(hour)} h from now`}
        className="flex-1 accent-accent"
      />
      <output className="tabular w-14 text-right font-mono">+{hour} h</output>
    </label>
  )
}

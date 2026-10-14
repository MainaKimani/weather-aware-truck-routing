/**
 * The forecast timeline (RFC §10.4, §10.6): which of the next 48 hours the
 * heatmap shows, with its clock time on the origin's clock, and playback.
 *
 * A native range input, so arrow keys, Home/End and screen readers work as
 * they do everywhere. Only this bar re-renders as the hour changes; the map
 * follows through its own subscription.
 *
 * Below the large breakpoint the bar takes two rows, playback and slider on
 * top and the hour's date and time under them, so the slider keeps its width
 * on a phone.
 *
 * Until a trip is on screen there's nothing to play: the controls are
 * disabled, and hovering them shows why. Disabled controls get no pointer
 * events, so the hover is on their wrapper; the same text describes them for
 * screen readers.
 */
import { useEffect, useId } from 'react'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { formatClockTime } from '../../lib/format'
import { browserZone } from '../../lib/time'
import { MAX_HOUR, useTimelineStore } from '../../state/timeline'
import { hourLabel, hourValueText, windowEndBeforeDeparture } from './clock'
import { useTimelineStart } from './useTimelineStart'

/** One forecast hour per step while playing (RFC §10.4). */
export const PLAY_STEP_MS = 250
const TICKS = Array.from({ length: MAX_HOUR / 6 + 1 }, (_, i) => i * 6)

const selectDeparture = (plan: Plan) => plan.inputs.departure
const selectZone = (plan: Plan) => plan.inputs.origin.tz ?? undefined
const selectHasRoutes = (plan: Plan) => plan.routes.length > 0

export const NO_TRIP_HINT = 'Plan a trip to play or scrub the forecast.'

export function HourSlider() {
  const hour = useTimelineStore((s) => s.hour)
  const playing = useTimelineStore((s) => s.playing)
  const setHour = useTimelineStore((s) => s.setHour)
  const setPlaying = useTimelineStore((s) => s.setPlaying)
  const start = useTimelineStart()
  const zone = usePlan(selectZone) ?? browserZone()
  const windowEnd = windowEndBeforeDeparture(start, MAX_HOUR, usePlan(selectDeparture))
  const ticksId = useId()
  const hintId = useId()
  const ready = usePlan(selectHasRoutes) === true
  usePlayback(playing && ready)

  return (
    <div className="px-4 py-2 text-sm">
      <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-3">
        <div className="group relative flex min-w-0 flex-1 items-center gap-3">
          {!ready && (
            <span
              id={hintId}
              role="tooltip"
              className="pointer-events-none absolute bottom-full left-0 mb-2 hidden rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-canvas shadow-overlay group-hover:block"
            >
              {NO_TRIP_HINT}
            </span>
          )}
          <button
            type="button"
            disabled={!ready}
            aria-describedby={ready ? undefined : hintId}
            onClick={() => {
              setPlaying(!playing)
            }}
            aria-label={playing && ready ? 'Pause forecast' : 'Play forecast'}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-surface hover:bg-surface-raised disabled:pointer-events-none disabled:opacity-50"
          >
            <span aria-hidden="true">{playing && ready ? '❚❚' : '▶'}</span>
          </button>
          <label className="flex flex-1 items-center gap-3">
            <span className="text-muted">Forecast</span>
            <span className="flex flex-1 flex-col">
              <input
                type="range"
                min={0}
                max={MAX_HOUR}
                step={1}
                value={hour}
                list={ticksId}
                disabled={!ready}
                aria-describedby={ready ? undefined : hintId}
                onChange={(e) => {
                  // Taking hold of the slider stops playback.
                  if (playing) setPlaying(false)
                  setHour(e.currentTarget.valueAsNumber)
                }}
                aria-valuetext={hourValueText(start, hour, zone)}
                className="w-full accent-accent disabled:pointer-events-none disabled:opacity-50"
              />
              <span aria-hidden="true" className="flex justify-between text-[10px] text-muted">
                {TICKS.map((tick) => (
                  <span key={tick} className="tabular w-0 text-center">
                    {`+${String(tick)}`}
                  </span>
                ))}
              </span>
            </span>
          </label>
        </div>
        <datalist id={ticksId}>
          {TICKS.map((tick) => (
            <option key={tick} value={tick} />
          ))}
        </datalist>
        <output className="tabular text-center font-mono whitespace-nowrap lg:min-w-52 lg:shrink-0 lg:text-right">
          {hourLabel(start, hour, zone)}
        </output>
      </div>
      {windowEnd && (
        <p className="mt-1 text-xs text-muted">
          The forecast runs to {formatClockTime(windowEnd, zone)}, before this trip departs, so the
          heatmap can&apos;t show the trip&apos;s own hours.
        </p>
      )}
    </div>
  )
}

/** While playing, steps one hour every PLAY_STEP_MS, back to the start after the last. */
function usePlayback(playing: boolean) {
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      const { hour, setHour } = useTimelineStore.getState()
      setHour(hour >= MAX_HOUR ? 0 : hour + 1)
    }, PLAY_STEP_MS)
    return () => {
      clearInterval(timer)
    }
  }, [playing])
}

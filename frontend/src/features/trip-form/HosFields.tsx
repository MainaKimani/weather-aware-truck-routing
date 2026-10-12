/**
 * Hours of Service (PRD §7.3.1): off by default. Turned on, it asks for the
 * four ELD clocks so the plan can add the breaks and rests the rules require.
 */
import { useId, useState } from 'react'
import { Controller, useWatch, type Control, type UseFormSetValue } from 'react-hook-form'

import { FieldError, inputClass } from './fields'
import { CLOCKS, CYCLE_HOURS, CYCLE_LABELS, HOS_MESSAGES, parseClock, type Cycle } from './hos'
import type { TripFormValues } from './schema'

interface HosFieldsProps {
  control: Control<TripFormValues>
  setValue: UseFormSetValue<TripFormValues>
}

export function HosFields({ control, setValue }: HosFieldsProps) {
  const enabled = useWatch({ control, name: 'hos.enabled' })
  const cycle = useWatch({ control, name: 'hos.cycle' })
  const cycleLeft = useWatch({ control, name: 'hos.cycleLeft' })
  const [capped, setCapped] = useState<string | null>(null)
  const regionId = useId()
  const cycleId = useId()

  const changeCycle = (next: Cycle) => {
    setValue('hos.cycle', next)
    const limit = CYCLE_HOURS[next] * 60
    const current = parseClock(cycleLeft)
    if (current !== null && current > limit) {
      setValue('hos.cycleLeft', `${String(CYCLE_HOURS[next])}:00`, { shouldValidate: true })
      setCapped(HOS_MESSAGES.cycleCapped(CYCLE_HOURS[next]))
    } else {
      setCapped(null)
    }
  }

  return (
    <div className="rounded-card border border-line">
      <Controller
        control={control}
        name="hos.enabled"
        render={({ field }) => (
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <span id={`${regionId}-label`} className="text-sm font-medium">
              Hours of Service
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={field.value}
              aria-labelledby={`${regionId}-label`}
              aria-controls={regionId}
              onClick={() => {
                field.onChange(!field.value)
              }}
              className="relative h-6 w-11 rounded-full bg-line transition-colors aria-checked:bg-accent"
            >
              <span
                aria-hidden="true"
                className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow transition-transform ${field.value ? 'translate-x-5' : ''}`}
              />
            </button>
          </div>
        )}
      />

      <div id={regionId} hidden={!enabled} className="space-y-3 border-t border-line px-3 py-3">
        <div>
          <label htmlFor={cycleId} className="text-sm font-medium">
            Cycle
          </label>
          <select
            id={cycleId}
            value={cycle}
            onChange={(e) => {
              changeCycle(e.currentTarget.value as Cycle)
            }}
            className={inputClass}
          >
            {(Object.keys(CYCLE_LABELS) as Cycle[]).map((c) => (
              <option key={c} value={c}>
                {CYCLE_LABELS[c]}
              </option>
            ))}
          </select>
          {capped && (
            <p role="status" className="mt-1 text-xs text-muted">
              {capped}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CLOCKS.map(({ field: name, label, maxH }) => (
            <Controller
              key={name}
              control={control}
              name={`hos.${name}`}
              render={({ field, fieldState }) => {
                const id = `${regionId}-${name}`
                return (
                  <div>
                    <label htmlFor={id} className="text-xs font-medium">
                      {label}
                    </label>
                    <input
                      id={id}
                      name={field.name}
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      inputMode="numeric"
                      placeholder="hh:mm"
                      autoComplete="off"
                      aria-invalid={fieldState.error ? true : undefined}
                      aria-describedby={`${id}-max ${fieldState.error ? `${id}-err` : ''}`}
                      className={`${inputClass} tabular font-mono`}
                    />
                    <p id={`${id}-max`} className="mt-0.5 text-[11px] text-muted">
                      of {maxH(cycle)}:00
                    </p>
                    <FieldError id={`${id}-err`} message={fieldState.error?.message} />
                  </div>
                )
              }}
            />
          ))}
        </div>

        <HowItWorks />
      </div>
    </div>
  )
}

function HowItWorks() {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-accent">How is this calculated?</summary>
      <div className="mt-2 space-y-2 text-xs text-muted">
        <p>
          The plan takes the stops US property-carrying rules require, where the limit is reached,
          and moves every later arrival time by their length:
        </p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>After 11 h of driving, or the 14th hour since the shift started: a 10 h rest.</li>
          <li>After 8 h of driving without one: a 30 min break.</li>
          <li>When the 70 h / 8 day (or 60 h / 7 day) cycle runs out: a 34 h restart.</li>
        </ul>
        <p>Simplifications:</p>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>All trip time is driving; fuel, inspections and loading aren't modelled.</li>
          <li>
            Cycle hours don't roll off during the trip, so a restart may come early, never late.
          </li>
          <li>No sleeper-berth split, adverse-driving extension or short-haul exemption.</li>
          <li>Stops happen where the limit is hit, not at a real truck stop.</li>
        </ul>
      </div>
    </details>
  )
}

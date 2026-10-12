/**
 * The trip form (PRD §7.1). React Hook Form holds the values; the Zod schema
 * in schema.ts validates them with the API's own rules and messages. Errors
 * the server finds anyway (a stale clock, a rule the browser can't check)
 * land on the same fields.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useMemo, useState } from 'react'
import { Controller, useForm, useWatch, type Control, type Resolver } from 'react-hook-form'

import { usePlanTrip } from '../../api/plans'
import { DEMO_DESTINATION, DEMO_LOAD_LB, DEMO_ORIGIN } from '../plan/demoTrip'
import { PlanError } from '../plan/PlanError'
import { nextWholeHourInput, zoneAbbreviation, zonedToUtc } from '../../lib/time'
import { Chip, FieldError, inputClass } from './fields'
import { PlaceCombobox } from './PlaceCombobox'
import { LOW_CONFIDENCE_AHEAD_MS } from './rules'
import {
  INTERVALS,
  departureZone,
  emptyValues,
  formFieldFor,
  parseLoad,
  toPlanRequest,
  tripFormSchema,
  type TripFormValues,
} from './schema'

interface TripFormProps {
  /** Injected in tests; the real clock otherwise. */
  now?: () => Date
}

export function TripForm({ now = () => new Date() }: TripFormProps) {
  const schema = useMemo(() => tripFormSchema(now), [now])
  const { control, handleSubmit, setError, setValue, reset, getValues, formState } =
    useForm<TripFormValues>({
      resolver: zodResolver(schema) as Resolver<TripFormValues>,
      defaultValues: emptyValues(
        nextWholeHourInput(now(), departureZone({ text: '', place: null })),
      ),
      reValidateMode: 'onChange',
    })
  const { plan, isPending, error } = usePlanTrip()
  const [collapsed, setCollapsed] = useState(false)
  const ids = { departure: useId(), load: useId(), root: useId() }

  // Field errors the server found anyway go next to their inputs.
  useEffect(() => {
    if (error?.code !== 'invalid_input') return
    for (const [apiField, messages] of Object.entries(error.fields)) {
      const field = formFieldFor(apiField)
      const message = messages.join(' ')
      if (field) setError(field, { type: 'server', message }, { shouldFocus: true })
      else setError('root.server', { type: 'server', message: `${apiField}: ${message}` })
    }
  }, [error, setError])

  const submit = handleSubmit((values) => {
    plan(toPlanRequest(values), {
      onSuccess: () => {
        setCollapsed(true)
      },
    })
  })

  const fillDemo = () => {
    reset({
      ...getValues(),
      origin: { text: DEMO_ORIGIN.label, place: DEMO_ORIGIN },
      destination: { text: DEMO_DESTINATION.label, place: DEMO_DESTINATION },
      departureLocal: nextWholeHourInput(now(), DEMO_ORIGIN.tz ?? 'UTC'),
      loadLb: DEMO_LOAD_LB.toLocaleString('en-US'),
    })
  }

  if (collapsed) {
    return (
      <TripSummary
        values={getValues()}
        onEdit={() => {
          setCollapsed(false)
        }}
      />
    )
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-label="Trip" className="space-y-4">
      <div className="relative space-y-3">
        <Controller
          control={control}
          name="origin"
          render={({ field, fieldState }) => (
            <PlaceCombobox
              label="Origin"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              adornment={field.value.place?.tz && <Chip>{field.value.place.tz}</Chip>}
            />
          )}
        />
        <SwapButton
          onSwap={() => {
            const { origin, destination } = getValues()
            setValue('origin', destination, { shouldValidate: formState.isSubmitted })
            setValue('destination', origin, { shouldValidate: formState.isSubmitted })
          }}
        />
        <Controller
          control={control}
          name="destination"
          render={({ field, fieldState }) => (
            <PlaceCombobox
              label="Destination"
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>

      <DepartureField control={control} now={now} id={ids.departure} />

      <Controller
        control={control}
        name="loadLb"
        render={({ field, fieldState }) => (
          <div>
            <label htmlFor={ids.load} className="text-sm font-medium">
              Load weight <span className="font-normal text-muted">(lb)</span>
            </label>
            <input
              id={ids.load}
              name={field.name}
              ref={field.ref}
              value={field.value}
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 42,000"
              onChange={field.onChange}
              onBlur={() => {
                const n = parseLoad(field.value)
                if (n !== null) field.onChange(n.toLocaleString('en-US'))
                field.onBlur()
              }}
              aria-invalid={fieldState.error ? true : undefined}
              aria-describedby={`${ids.load}-hint ${fieldState.error ? `${ids.load}-err` : ''}`}
              className={`${inputClass} tabular`}
            />
            <p id={`${ids.load}-hint`} className="mt-1 text-xs text-muted">
              Over 30,000 lb and 40,000 lb, strong gusts rate higher.
            </p>
            <FieldError id={`${ids.load}-err`} message={fieldState.error?.message} />
          </div>
        )}
      />

      <Controller
        control={control}
        name="intervalMi"
        render={({ field }) => (
          <fieldset>
            <legend className="text-sm font-medium">Check weather every</legend>
            <div className="mt-1 inline-flex rounded-md border border-line p-0.5" role="radiogroup">
              {INTERVALS.map((n) => (
                <label
                  key={n}
                  className="cursor-pointer rounded px-3 py-1 text-sm has-checked:bg-accent has-checked:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-focus"
                >
                  <input
                    type="radio"
                    name={field.name}
                    value={n}
                    checked={field.value === n}
                    onChange={() => {
                      field.onChange(n)
                    }}
                    className="sr-only"
                  />
                  {n} mi
                </label>
              ))}
            </div>
          </fieldset>
        )}
      />

      {error && error.code !== 'invalid_input' && (
        <PlanError error={error} onRetry={() => void submit()} />
      )}

      {formState.errors.root?.server && (
        <p role="alert" className="text-sm text-danger">
          {formState.errors.root.server.message}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="flex-1 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-accent-ink hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? 'Evaluating weather corridors…' : 'Plan trip'}
        </button>
        <button
          type="button"
          onClick={fillDemo}
          className="text-sm text-accent underline-offset-2 hover:underline"
        >
          Use the demo trip
        </button>
      </div>
    </form>
  )
}

function SwapButton({ onSwap }: { onSwap: () => void }) {
  return (
    <button
      type="button"
      onClick={onSwap}
      aria-label="Swap origin and destination"
      title="Swap origin and destination"
      className="absolute top-[3.1rem] right-2 z-10 inline-flex size-7 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-ink"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
      </svg>
    </button>
  )
}

function DepartureField({
  control,
  now,
  id,
}: {
  control: Control<TripFormValues>
  now: () => Date
  id: string
}) {
  const origin = useWatch({ control, name: 'origin' })
  const zone = departureZone(origin)

  return (
    <Controller
      control={control}
      name="departureLocal"
      render={({ field, fieldState }) => {
        const when = parseDeparture(field.value, zone)
        const far = when !== null && when.getTime() - now().getTime() > LOW_CONFIDENCE_AHEAD_MS
        return (
          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor={id} className="text-sm font-medium">
                Departure
              </label>
              <Chip title={zone}>{zoneAbbreviation(when ?? now(), zone)}</Chip>
            </div>
            <input
              id={id}
              type="datetime-local"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              step={60}
              aria-invalid={fieldState.error ? true : undefined}
              aria-describedby={`${id}-hint ${fieldState.error ? `${id}-err` : ''}`}
              className={`${inputClass} tabular`}
            />
            <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
              {origin.place ? `Local time at ${origin.place.label}` : 'Your local time'} ({zone})
            </p>
            {far && (
              <p className="mt-1 text-xs text-muted">
                More than 48 h ahead: forecasts this far out are less reliable.
              </p>
            )}
            <FieldError id={`${id}-err`} message={fieldState.error?.message} />
          </div>
        )
      }}
    />
  )
}

/** The departure instant, or null while the input is empty or half-typed. */
function parseDeparture(local: string, zone: string): Date | null {
  try {
    return local ? zonedToUtc(local, zone) : null
  } catch {
    return null
  }
}

function TripSummary({ values, onEdit }: { values: TripFormValues; onEdit: () => void }) {
  const zone = departureZone(values.origin)
  const when = zonedToUtc(values.departureLocal, zone)
  const departure = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(when)
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border border-line bg-surface-raised p-3">
      <div className="min-w-0 text-sm">
        <p className="truncate font-semibold">
          {values.origin.text} → {values.destination.text}
        </p>
        <p className="tabular mt-0.5 text-muted">
          {departure} {zoneAbbreviation(when, zone)} · {values.loadLb} lb · every{' '}
          {values.intervalMi} mi
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-md border border-line px-2.5 py-1 text-sm font-medium hover:bg-surface"
      >
        Edit trip
      </button>
    </div>
  )
}

/**
 * Trip form values, their validation, and the API request they become.
 * Rules and messages come from rules.ts, which mirrors the API.
 */
import { z } from 'zod'

import type { Place, PlanRequest } from '../../api/schema'
import { haversineMi } from '../../lib/geo'
import { browserZone, zonedToUtc } from '../../lib/time'
import { hosErrors, hosFieldFor, restedHos, toHosRequest, type HosValues } from './hos'
import {
  DEPARTURE_GRACE_MS,
  DEPARTURE_MAX_AHEAD_MS,
  MAX_LOAD_LB,
  MESSAGES,
  MIN_TRIP_MI,
} from './rules'

export const INTERVALS = [10, 25, 50] as const
export type Interval = (typeof INTERVALS)[number]

/** What the user typed, and the suggestion they picked (null until they pick one). */
export interface PlaceValue {
  text: string
  place: Place | null
}

export interface TripFormValues {
  origin: PlaceValue
  destination: PlaceValue
  /** "YYYY-MM-DDTHH:mm" on the origin's clock. */
  departureLocal: string
  /** As typed, thousands separators allowed. */
  loadLb: string
  intervalMi: Interval
  hos: HosValues
}

export function emptyValues(departureLocal: string): TripFormValues {
  return {
    origin: { text: '', place: null },
    destination: { text: '', place: null },
    departureLocal,
    loadLb: '',
    intervalMi: 25,
    hos: restedHos(),
  }
}

/** The zone the departure is entered in: the origin's, or this browser's until one is picked. */
export function departureZone(origin: PlaceValue): string {
  return origin.place?.tz ?? browserZone()
}

/** Digits only, or null if the text isn't a whole number. */
export function parseLoad(text: string): number | null {
  const digits = text.replace(/[\s,]/g, '')
  return /^\d+$/.test(digits) ? Number(digits) : null
}

const placeValue = z.object({
  text: z.string(),
  place: z
    .object({ label: z.string(), lat: z.number(), lon: z.number(), tz: z.string().nullable() })
    .nullable(),
})

export function tripFormSchema(now: () => Date = () => new Date()) {
  return z
    .object({
      origin: placeValue,
      destination: placeValue,
      departureLocal: z.string(),
      loadLb: z.string(),
      intervalMi: z.union(
        INTERVALS.map((n) => z.literal(n)),
        {
          error: (issue) => MESSAGES.choice(issue.input),
        },
      ),
      hos: z.object({
        enabled: z.boolean(),
        cycle: z.enum(['70h_8d', '60h_7d']),
        driveLeft: z.string(),
        windowLeft: z.string(),
        untilBreak: z.string(),
        cycleLeft: z.string(),
      }),
    })
    .superRefine((v, ctx) => {
      const issue = (path: string, message: string) => {
        ctx.addIssue({ code: 'custom', path: path.split('.'), message })
      }

      for (const key of ['origin', 'destination'] as const) {
        const { text, place } = v[key]
        if (!place) issue(key, text.trim() ? MESSAGES.pickPlace : MESSAGES.required)
      }
      if (
        v.origin.place &&
        v.destination.place &&
        haversineMi(v.origin.place, v.destination.place) <= MIN_TRIP_MI
      ) {
        issue('destination', MESSAGES.samePlace)
      }

      if (!v.departureLocal) {
        issue('departureLocal', MESSAGES.required)
      } else {
        const departure = zonedToUtc(v.departureLocal, departureZone(v.origin)).getTime()
        const t = now().getTime()
        if (departure < t - DEPARTURE_GRACE_MS) issue('departureLocal', MESSAGES.departurePast)
        else if (departure > t + DEPARTURE_MAX_AHEAD_MS)
          issue('departureLocal', MESSAGES.departureTooFar)
      }

      if (!v.loadLb.trim()) {
        issue('loadLb', MESSAGES.required)
      } else {
        const load = parseLoad(v.loadLb)
        if (load === null) issue('loadLb', MESSAGES.integer)
        else if (load < 1) issue('loadLb', MESSAGES.min(1))
        else if (load > MAX_LOAD_LB) issue('loadLb', MESSAGES.max(MAX_LOAD_LB))
      }

      for (const [field, message] of Object.entries(hosErrors(v.hos))) {
        issue(`hos.${field}`, message)
      }
    })
}

/** The API request for valid form values. */
export function toPlanRequest(v: TripFormValues): PlanRequest {
  const origin = v.origin.place
  const destination = v.destination.place
  const load = parseLoad(v.loadLb)
  if (!origin || !destination || load === null) throw new Error('form values are not valid')
  return {
    origin,
    destination,
    departure: zonedToUtc(v.departureLocal, departureZone(v.origin)).toISOString(),
    load_lb: load,
    interval_mi: v.intervalMi,
    hos: toHosRequest(v.hos),
  }
}

export type FormField = keyof Omit<TripFormValues, 'hos'> | `hos.${keyof HosValues}`

/** Where an API field error belongs on the form ("origin.lat" → "origin"). */
export function formFieldFor(apiField: string): FormField | null {
  const top = apiField.split('.')[0]
  switch (top) {
    case 'origin':
    case 'destination':
      return top
    case 'departure':
      return 'departureLocal'
    case 'load_lb':
      return 'loadLb'
    case 'interval_mi':
      return 'intervalMi'
    case 'hos': {
      const field = hosFieldFor(apiField)
      return field ? `hos.${field}` : null
    }
    default:
      return null
  }
}

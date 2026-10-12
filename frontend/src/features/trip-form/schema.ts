/**
 * Trip form values, their validation, and the API request they become.
 * Rules and messages come from rules.ts, which mirrors the API.
 */
import { z } from 'zod'

import type { Place, PlanRequest } from '../../api/schema'
import { haversineMi } from '../../lib/geo'
import { browserZone, zonedToUtc } from '../../lib/time'
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
}

export function emptyValues(departureLocal: string): TripFormValues {
  return {
    origin: { text: '', place: null },
    destination: { text: '', place: null },
    departureLocal,
    loadLb: '',
    intervalMi: 25,
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
  }
}

/** Where an API field error belongs on the form ("origin.lat" → "origin"). */
export function formFieldFor(apiField: string): keyof TripFormValues | null {
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
    default:
      return null
  }
}

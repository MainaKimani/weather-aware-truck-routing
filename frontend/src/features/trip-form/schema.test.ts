import { describe, expect, it } from 'vitest'

import { DEMO_DESTINATION, DEMO_ORIGIN } from '../plan/demoTrip'
import { restedHos } from './hos'
import { MESSAGES } from './rules'
import { formFieldFor, toPlanRequest, tripFormSchema, type TripFormValues } from './schema'

const NOW = new Date('2026-10-12T10:20:00Z') // 05:20 in Dallas
const schema = tripFormSchema(() => NOW)

const valid: TripFormValues = {
  origin: { text: 'Dallas, TX', place: DEMO_ORIGIN },
  destination: { text: 'Denver, CO', place: DEMO_DESTINATION },
  departureLocal: '2026-10-12T06:00',
  loadLb: '42,000',
  intervalMi: 25,
  hos: restedHos(),
}

function errors(values: Partial<TripFormValues>): Record<string, string[]> {
  const result = schema.safeParse({ ...valid, ...values })
  if (result.success) return {}
  const out: Record<string, string[]> = {}
  for (const issue of result.error.issues) (out[issue.path.join('.')] ??= []).push(issue.message)
  return out
}

describe('trip form rules (mirroring the API)', () => {
  it('accepts a valid trip', () => {
    expect(errors({})).toEqual({})
  })

  it.each([
    [{ loadLb: '' }, 'loadLb', MESSAGES.required],
    [{ loadLb: '4.5' }, 'loadLb', MESSAGES.integer],
    [{ loadLb: 'heavy' }, 'loadLb', MESSAGES.integer],
    [{ loadLb: '0' }, 'loadLb', 'Ensure this value is greater than or equal to 1.'],
    [{ loadLb: '80,001' }, 'loadLb', 'Ensure this value is less than or equal to 80000.'],
    [{ departureLocal: '' }, 'departureLocal', MESSAGES.required],
    // 15 minutes of grace: 05:04 Dallas is 16 min ago.
    [{ departureLocal: '2026-10-12T05:04' }, 'departureLocal', "Departure can't be in the past."],
    [
      { departureLocal: '2026-10-19T06:00' },
      'departureLocal',
      'Departure must be within the next 7 days.',
    ],
    [{ origin: { text: '', place: null } }, 'origin', MESSAGES.required],
    [{ origin: { text: 'Dallsa', place: null } }, 'origin', MESSAGES.pickPlace],
    [
      { destination: { text: 'Dallas', place: { ...DEMO_ORIGIN, lat: DEMO_ORIGIN.lat + 0.01 } } },
      'destination',
      'Destination must be more than a mile from the origin.',
    ],
  ] as const)('%o fails on %s with the API message', (values, field, message) => {
    expect(errors(values)[field]).toEqual([message])
  })

  it.each(['1', '80,000', ' 42 000 '])('accepts a load of %s', (loadLb) => {
    expect(errors({ loadLb })).toEqual({})
  })

  it('allows a departure up to 15 minutes ago', () => {
    expect(errors({ departureLocal: '2026-10-12T05:06' })).toEqual({})
  })

  it('reads the departure on the origin clock', () => {
    // 06:00 in Denver is 12:00 UTC; the same text in Dallas is 11:00 UTC.
    const fromDenver = { ...valid, origin: valid.destination, destination: valid.origin }
    expect(toPlanRequest(fromDenver).departure).toBe('2026-10-12T12:00:00.000Z')
    expect(toPlanRequest(valid)).toEqual({
      origin: DEMO_ORIGIN,
      destination: DEMO_DESTINATION,
      departure: '2026-10-12T11:00:00.000Z',
      load_lb: 42_000,
      interval_mi: 25,
      hos: { enabled: false },
    })
  })

  it('routes API field errors to form fields', () => {
    expect(formFieldFor('origin.lat')).toBe('origin')
    expect(formFieldFor('departure')).toBe('departureLocal')
    expect(formFieldFor('load_lb')).toBe('loadLb')
    expect(formFieldFor('interval_mi')).toBe('intervalMi')
    expect(formFieldFor('non_field_errors')).toBeNull()
  })
})

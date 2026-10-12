import type { Place, PlanRequest } from '../../api/schema'

/** The walkthrough's trip: Dallas to Denver with 42,000 lb, leaving in an hour. */
export const DEMO_ORIGIN: Place = {
  label: 'Dallas, TX',
  lat: 32.7767,
  lon: -96.797,
  tz: 'America/Chicago',
}
export const DEMO_DESTINATION: Place = {
  label: 'Denver, CO',
  lat: 39.7392,
  lon: -104.9903,
  tz: 'America/Denver',
}
export const DEMO_LOAD_LB = 42_000

export function demoTripRequest(now: Date = new Date()): PlanRequest {
  const departure = new Date(now.getTime() + 60 * 60 * 1000)
  departure.setUTCSeconds(0, 0)
  return {
    origin: DEMO_ORIGIN,
    destination: DEMO_DESTINATION,
    departure: departure.toISOString(),
    load_lb: DEMO_LOAD_LB,
    interval_mi: 25,
  }
}

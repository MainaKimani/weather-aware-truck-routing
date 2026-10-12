import type { PlanRequest } from '../../api/schema'

/** Dallas to Denver, leaving in an hour, the walkthrough's trip. */
export function demoTripRequest(now: Date = new Date()): PlanRequest {
  const departure = new Date(now.getTime() + 60 * 60 * 1000)
  departure.setUTCSeconds(0, 0)
  return {
    origin: { label: 'Dallas, TX', lat: 32.7767, lon: -96.797, tz: 'America/Chicago' },
    destination: { label: 'Denver, CO', lat: 39.7392, lon: -104.9903, tz: 'America/Denver' },
    departure: departure.toISOString(),
    load_lb: 42_000,
    interval_mi: 25,
  }
}

import type { TripSummary } from '../../api/schema'

/** "Dallas, TX → Denver, CO", or the name the owner gave the trip. */
export function tripTitle(trip: Pick<TripSummary, 'name' | 'origin' | 'destination'>): string {
  return trip.name || `${trip.origin} → ${trip.destination}`
}

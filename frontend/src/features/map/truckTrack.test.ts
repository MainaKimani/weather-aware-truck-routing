import { describe, expect, it } from 'vitest'

import type { Plan, Route } from '../../api/schema'
import { haversineMi } from '../../lib/geo'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { strongHosPlan } from '../../test/fixtures/strongHosPlan'
import { buildTruckTrack, truckAt } from './truckTrack'

const MINUTE = 60_000
const routes = (plan: Plan) => plan.routes.map((route) => [route.name, route] as const)
const allRoutes = [...routes(demoPlan), ...routes(strongHosPlan)]

function withStops(route: Route): Route {
  if (route.hos_stops.length === 0) throw new Error(`${route.name} has no HOS stops`)
  return route
}

describe('truck position', () => {
  it.each(allRoutes)('is on each checkpoint at its ETA (%s)', (_, route) => {
    const track = buildTruckTrack(route)

    for (const checkpoint of route.checkpoints) {
      const truck = truckAt(track, Date.parse(checkpoint.eta))
      expect(truck?.mile).toBeCloseTo(checkpoint.mile, 6)
      // Within 0.01 mi (50 ft); the worst is 0.002 mi, from the API rounding
      // coordinates and geometry to 5 decimal places.
      expect(haversineMi(checkpoint, truck ?? { lat: 0, lon: 0 })).toBeLessThan(0.01)
    }
  })

  it('is hidden before departure and after arrival', () => {
    const route = demoPlan.routes[0] as Route
    const track = buildTruckTrack(route)

    expect(truckAt(track, Date.parse(route.departure) - MINUTE)).toBeNull()
    expect(truckAt(track, Date.parse(route.departure))).toMatchObject({ mile: 0 })
    expect(truckAt(track, Date.parse(route.arrival))).toMatchObject({ mile: route.distance_mi })
    expect(truckAt(track, Date.parse(route.arrival) + MINUTE)).toBeNull()
  })

  it('stands still at each HOS stop, from its start to its end', () => {
    const route = withStops(strongHosPlan.routes[0])
    const track = buildTruckTrack(route)

    for (const stop of route.hos_stops) {
      const start = Date.parse(stop.start)
      const end = start + stop.duration_s * 1000
      for (const at of [start, start + MINUTE, end - MINUTE]) {
        const truck = truckAt(track, at)
        expect(truck).toMatchObject({ mile: stop.mile, stopped: true })
        expect(haversineMi(stop, truck ?? { lat: 0, lon: 0 })).toBeLessThan(0.01)
      }
      expect(truckAt(track, end)).toMatchObject({ mile: stop.mile, stopped: false })
      expect(truckAt(track, end + MINUTE)?.mile).toBeGreaterThan(stop.mile)
    }
  })

  it.each(allRoutes)('only ever moves forward (%s)', (_, route) => {
    const track = buildTruckTrack(route)
    const departure = Date.parse(route.departure)
    const arrival = Date.parse(route.arrival)

    let previous = -1
    for (let at = departure; at <= arrival; at += 5 * MINUTE) {
      const mile = truckAt(track, at)?.mile ?? -1
      expect(mile).toBeGreaterThanOrEqual(previous)
      previous = mile
    }
  })
})

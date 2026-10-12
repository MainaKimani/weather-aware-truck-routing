import { describe, expect, it } from 'vitest'

import type { Plan } from '../../api/schema'
import { haversineMi } from '../../lib/geo'
import type { LonLat } from '../../lib/polyline'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { buildRouteGeometry, cumulativeMi, riskStretches, sliceLine } from './routeGeometry'

type PlanRoute = Plan['routes'][number]

const cp = (mile: number, level: PlanRoute['checkpoints'][number]['risk']['level']) =>
  ({ mile, risk: { level } }) as PlanRoute['checkpoints'][number]

const near = (a: LonLat | undefined, b: LonLat | undefined) => {
  if (!a || !b) return false
  return haversineMi({ lon: a[0], lat: a[1] }, { lon: b[0], lat: b[1] }) < 0.01
}

describe('riskStretches', () => {
  it('gives each checkpoint the miles halfway to its neighbours, merging equal levels', () => {
    const route = {
      distance_mi: 100,
      checkpoints: [cp(0, 'LOW'), cp(25, 'LOW'), cp(50, 'SEVERE'), cp(75, null), cp(100, 'LOW')],
    }

    expect(riskStretches(route)).toEqual([
      { from: 0, to: 37.5, level: 'LOW' },
      { from: 37.5, to: 62.5, level: 'SEVERE' },
      { from: 62.5, to: 87.5, level: 'UNKNOWN' },
      { from: 87.5, to: 100, level: 'LOW' },
    ])
  })

  it('draws a route with no checkpoints as Unknown, never Low', () => {
    expect(riskStretches({ distance_mi: 40, checkpoints: [] })).toEqual([
      { from: 0, to: 40, level: 'UNKNOWN' },
    ])
  })
})

describe('sliceLine', () => {
  // Three points along the equator, about 69 mi apart.
  const line: LonLat[] = [
    [0, 0],
    [1, 0],
    [2, 0],
  ]
  const along = cumulativeMi(line)

  it('cuts between two distances, interpolating the ends and keeping inner vertices', () => {
    const quarter = (along[2] ?? 0) / 4
    const part = sliceLine(line, along, quarter, 3 * quarter)

    expect(part).toHaveLength(3)
    expect(part[0]?.[0]).toBeCloseTo(0.5)
    expect(part[1]).toEqual([1, 0])
    expect(part[2]?.[0]).toBeCloseTo(1.5)
  })

  it('clamps to the ends of the line', () => {
    expect(sliceLine(line, along, -10, 1e6)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ])
  })
})

describe('buildRouteGeometry on the demo plan', () => {
  const geometry = buildRouteGeometry(demoPlan.routes)

  it('has one line per route', () => {
    expect(geometry.lines.features.map((f) => f.properties)).toEqual([
      { route: 'r1', rank: 1 },
      { route: 'r2', rank: 2 },
      { route: 'r3', rank: 3 },
    ])
  })

  it.each(demoPlan.routes.map((r) => [r.id, r] as const))(
    'covers route %s end to end with unbroken segments, in checkpoint-level order',
    (id, route) => {
      const line = geometry.lines.features.find((f) => f.properties.route === id)?.geometry
        .coordinates as LonLat[]
      const segments = geometry.segments.features.filter((f) => f.properties.route === id)

      expect(segments.map((s) => s.properties.level)).toEqual(
        riskStretches(route).map((s) => s.level),
      )
      expect(near(segments[0]?.geometry.coordinates[0] as LonLat, line[0])).toBe(true)
      expect(near(segments.at(-1)?.geometry.coordinates.at(-1) as LonLat, line.at(-1))).toBe(true)
      for (let i = 1; i < segments.length; i++) {
        const end = segments[i - 1]?.geometry.coordinates.at(-1) as LonLat
        const start = segments[i]?.geometry.coordinates[0] as LonLat
        expect(near(end, start)).toBe(true)
      }
    },
  )

  it('puts the storm where the checkpoints say it is', () => {
    const route = demoPlan.routes.find((r) => r.id === 'r2')
    const severe = route?.checkpoints.filter((c) => c.risk.level === 'SEVERE') ?? []
    const segment = geometry.segments.features.find(
      (f) => f.properties.route === 'r2' && f.properties.level === 'SEVERE',
    )
    expect(severe.length).toBeGreaterThan(0)
    expect(segment).toBeDefined()

    // Every Severe checkpoint lies on (within a mile of) the Severe stretch.
    const coords = segment?.geometry.coordinates as LonLat[]
    for (const c of severe) {
      const closest = Math.min(
        ...coords.map(([lon, lat]) => haversineMi({ lat, lon }, { lat: c.lat, lon: c.lon })),
      )
      expect(closest).toBeLessThan(1)
    }
  })
})

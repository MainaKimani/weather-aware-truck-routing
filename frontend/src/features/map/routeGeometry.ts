/**
 * Route lines for the map, built once per plan (RFC §10.3).
 *
 * `lines` holds each route's whole polyline. `segments` splits every route
 * into stretches coloured by checkpoint risk: each checkpoint colours the
 * miles it owns (half the gap to each neighbour, as the backend counts them),
 * and neighbours with the same level are merged into one line. Every route is
 * split, not just the selected one, so selecting another route only changes a
 * filter.
 *
 * Checkpoint miles are the provider's reported miles. The decoded polyline is
 * a little longer or shorter, so distances along it are scaled to match, as
 * the backend does when it places the checkpoints.
 */
import type { Feature, FeatureCollection, LineString } from 'geojson'

import type { Plan } from '../../api/schema'
import { haversineMi } from '../../lib/geo'
import { decodePolyline, type LonLat } from '../../lib/polyline'
import type { RiskBucket } from '../../lib/risk'

type PlanRoute = Plan['routes'][number]

export interface RouteLineProps {
  route: string
  rank: number
}

export interface SegmentProps {
  route: string
  level: RiskBucket
}

export interface RouteGeometry {
  lines: FeatureCollection<LineString, RouteLineProps>
  segments: FeatureCollection<LineString, SegmentProps>
}

export function buildRouteGeometry(routes: readonly PlanRoute[]): RouteGeometry {
  const lines: Feature<LineString, RouteLineProps>[] = []
  const segments: Feature<LineString, SegmentProps>[] = []

  for (const route of routes) {
    const line = decodePolyline(route.geometry)
    if (line.length < 2) continue
    lines.push(lineFeature(line, { route: route.id, rank: route.rank }))

    const along = cumulativeMi(line)
    const total = along.at(-1) ?? 0
    if (total <= 0) continue
    const geometricPerReported = total / route.distance_mi
    for (const stretch of riskStretches(route)) {
      const part = sliceLine(
        line,
        along,
        stretch.from * geometricPerReported,
        stretch.to * geometricPerReported,
      )
      if (part.length >= 2) {
        segments.push(lineFeature(part, { route: route.id, level: stretch.level }))
      }
    }
  }

  return {
    lines: { type: 'FeatureCollection', features: lines },
    segments: { type: 'FeatureCollection', features: segments },
  }
}

function lineFeature<P>(coordinates: LonLat[], properties: P): Feature<LineString, P> {
  return { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties }
}

export interface Stretch {
  /** Reported miles from the origin. */
  from: number
  to: number
  level: RiskBucket
}

/** The route's miles by checkpoint level, with same-level neighbours merged. */
export function riskStretches(route: Pick<PlanRoute, 'checkpoints' | 'distance_mi'>): Stretch[] {
  const cps = route.checkpoints
  if (cps.length === 0) return [{ from: 0, to: route.distance_mi, level: 'UNKNOWN' }]

  const stretches: Stretch[] = []
  cps.forEach((cp, i) => {
    const prev = cps[i - 1]
    const next = cps[i + 1]
    const from = prev ? (prev.mile + cp.mile) / 2 : 0
    const to = next ? (cp.mile + next.mile) / 2 : route.distance_mi
    const level = cp.risk.level ?? 'UNKNOWN'
    const last = stretches.at(-1)
    if (last?.level === level) last.to = to
    else stretches.push({ from, to, level })
  })
  return stretches
}

/** Miles from the start to each vertex. */
export function cumulativeMi(line: readonly LonLat[]): number[] {
  const out = [0]
  for (let i = 1; i < line.length; i++) {
    const [lon0, lat0] = line[i - 1] as LonLat
    const [lon1, lat1] = line[i] as LonLat
    out.push((out[i - 1] ?? 0) + haversineMi({ lat: lat0, lon: lon0 }, { lat: lat1, lon: lon1 }))
  }
  return out
}

/** The part of `line` between two distances along it (miles, clamped to the line). */
export function sliceLine(
  line: readonly LonLat[],
  along: readonly number[],
  from: number,
  to: number,
): LonLat[] {
  const total = along.at(-1) ?? 0
  const start = Math.max(0, Math.min(from, total))
  const end = Math.max(start, Math.min(to, total))
  const out: LonLat[] = [pointAt(line, along, start)]
  for (let i = 0; i < line.length; i++) {
    const d = along[i] ?? 0
    if (d > start && d < end) out.push(line[i] as LonLat)
  }
  out.push(pointAt(line, along, end))
  return out
}

function pointAt(line: readonly LonLat[], along: readonly number[], d: number): LonLat {
  // The vertex at or before d (binary search), then interpolate to the next.
  let lo = 0
  let hi = along.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if ((along[mid] ?? 0) <= d) lo = mid
    else hi = mid - 1
  }
  const a = line[lo] as LonLat
  const b = line[lo + 1]
  if (!b) return [a[0], a[1]]
  const d0 = along[lo] ?? 0
  const span = (along[lo + 1] ?? d0) - d0
  const t = span > 0 ? (d - d0) / span : 0
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

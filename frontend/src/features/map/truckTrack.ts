/**
 * Where a route's truck is at a given time (RFC §10.4): the slider's hour,
 * placed on the route from the plan's own schedule.
 *
 * The schedule is the checkpoints' ETAs, plus each Hours of Service stop as
 * two points at the same mile (its start and its end), so the truck stands
 * still while it stops. Between those points the mile is interpolated by
 * time, then found on the route's line the way the backend places
 * checkpoints: the line's length scaled to the route's reported miles. At a
 * checkpoint's ETA the truck is therefore on that checkpoint.
 */
import type { Route } from '../../api/schema'
import { haversineMi } from '../../lib/geo'
import { decodePolyline, type LonLat } from '../../lib/polyline'

interface Waypoint {
  /** Epoch ms. */
  at: number
  mile: number
  /** True when the truck stays here until the next waypoint (an HOS stop). */
  stopped: boolean
}

export interface TruckTrack {
  waypoints: readonly Waypoint[]
  line: readonly LonLat[]
  /** Reported miles at each point of `line`. */
  miles: readonly number[]
}

export interface TruckPosition {
  lon: number
  lat: number
  mile: number
  stopped: boolean
}

export function buildTruckTrack(route: Route): TruckTrack {
  const waypoints: Waypoint[] = [
    { at: Date.parse(route.departure), mile: 0, stopped: false },
    ...route.checkpoints.map((c) => ({ at: Date.parse(c.eta), mile: c.mile, stopped: false })),
    ...route.hos_stops.flatMap((s) => {
      const start = Date.parse(s.start)
      return [
        { at: start, mile: s.mile, stopped: true },
        { at: start + s.duration_s * 1000, mile: s.mile, stopped: false },
      ]
    }),
    { at: Date.parse(route.arrival), mile: route.distance_mi, stopped: false },
  ]
  // By time; at the same instant a stop's start goes last, so the truck is
  // shown stopped from the moment the stop begins.
  waypoints.sort((a, b) => a.at - b.at || Number(a.stopped) - Number(b.stopped))

  const line = decodePolyline(route.geometry)
  const geometric = [0]
  for (let i = 1; i < line.length; i++) {
    const [lonA, latA] = line[i - 1] as LonLat
    const [lonB, latB] = line[i] as LonLat
    geometric.push(
      (geometric[i - 1] ?? 0) + haversineMi({ lat: latA, lon: lonA }, { lat: latB, lon: lonB }),
    )
  }
  const length = geometric.at(-1) ?? 0
  const scale = length > 0 ? route.distance_mi / length : 1
  return { waypoints, line, miles: geometric.map((d) => d * scale) }
}

/** The truck at `at` (epoch ms), or null before it leaves or after it arrives. */
export function truckAt(track: TruckTrack, at: number): TruckPosition | null {
  const { waypoints } = track
  const first = waypoints[0]
  const last = waypoints.at(-1)
  if (!first || !last || at < first.at || at > last.at) return null

  // The last waypoint at or before `at`, and the one after it.
  let i = 0
  while (i + 1 < waypoints.length && (waypoints[i + 1] as Waypoint).at <= at) i++
  const from = waypoints[i] as Waypoint
  const to = waypoints[i + 1] ?? from
  const span = to.at - from.at
  const f = span > 0 ? (at - from.at) / span : 0
  const mile = from.mile + (to.mile - from.mile) * f
  const [lon, lat] = pointAtMile(track, mile)
  return { lon, lat, mile, stopped: from.stopped }
}

function pointAtMile({ line, miles }: TruckTrack, mile: number): LonLat {
  const first = line[0]
  if (!first) return [0, 0]
  if (mile <= 0 || line.length === 1) return first
  const end = miles.at(-1) ?? 0
  if (mile >= end) return line.at(-1) ?? first
  // The first point at or past `mile`; a route's line has thousands of points.
  let lo = 1
  let hi = line.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((miles[mid] ?? end) < mile) lo = mid + 1
    else hi = mid
  }
  const i = lo
  const [lonA, latA] = line[i - 1] as LonLat
  const [lonB, latB] = line[i] as LonLat
  const a = miles[i - 1] ?? 0
  const b = miles[i] ?? a
  const t = b > a ? (mile - a) / (b - a) : 0
  return [lonA + (lonB - lonA) * t, latA + (latB - latA) * t]
}

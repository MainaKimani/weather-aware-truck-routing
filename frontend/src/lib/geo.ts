/** Great-circle distance in miles, as the backend measures it (mean Earth radius). */
const EARTH_RADIUS_MI = 3958.7613

export interface Point {
  lat: number
  lon: number
}

export function haversineMi(a: Point, b: Point): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(h)))
}

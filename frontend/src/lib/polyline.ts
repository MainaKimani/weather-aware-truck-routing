/**
 * Decodes Google's encoded polyline format, which the API uses for route
 * geometry (precision 5, as the backend encodes it).
 */
export type LonLat = [lon: number, lat: number]

/** The line's points in GeoJSON order: [longitude, latitude]. */
export function decodePolyline(encoded: string, precision = 5): LonLat[] {
  const factor = 10 ** precision
  const points: LonLat[] = []
  let index = 0
  let lat = 0
  let lon = 0

  const next = (): number => {
    let result = 0
    let shift = 0
    let byte: number
    do {
      byte = encoded.charCodeAt(index++) - 63
      result |= (byte & 0x1f) << shift
      shift += 5
    } while (byte >= 0x20)
    return result & 1 ? ~(result >> 1) : result >> 1
  }

  while (index < encoded.length) {
    lat += next()
    lon += next()
    points.push([lon / factor, lat / factor])
  }
  return points
}

/**
 * The heatmap response as map data (RFC §10.4): a point per grid cell, with
 * its risk level at each hour as flat properties `h0` … `h48`. Flat, because
 * MapLibre turns nested arrays in properties into strings, which an
 * expression can't index; with flat properties the slider changes only a
 * paint property and the data is uploaded once per heatmap.
 *
 * An hour with no forecast (Unknown) has no property, so it reads as null.
 */
import type { FeatureCollection, Point } from 'geojson'

import type { Heatmap } from '../../api/schema'

/** `h<hour>` → risk level 0 (Low) … 4 (No travel). */
export type HeatmapCell = Record<string, number>

export function buildHeatmapGeometry(heatmap: Heatmap): FeatureCollection<Point, HeatmapCell> {
  return {
    type: 'FeatureCollection',
    features: heatmap.points.map((point, i) => {
      const cell: HeatmapCell = {}
      heatmap.risk[i]?.forEach((level, hour) => {
        if (level !== null) cell[`h${String(hour)}`] = level
      })
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: point },
        properties: cell,
      }
    }),
  }
}

/** The grid's mean latitude, which sets how far apart its rows are drawn. */
export function meanLatitude(heatmap: Heatmap): number {
  if (heatmap.points.length === 0) return 0
  const sum = heatmap.points.reduce((total, [, lat]) => total + (lat ?? 0), 0)
  return sum / heatmap.points.length
}

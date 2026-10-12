/**
 * The heatmap response as map data (RFC §10.4): a point per grid cell, with
 * its risk level at each hour as flat properties `h0` … `h48`. Flat, because
 * MapLibre turns nested arrays in properties into strings, which an
 * expression can't index; with flat properties the slider changes only a
 * paint property and the data is uploaded once per heatmap.
 *
 * When the response has each condition's levels too (the metric switcher),
 * they go in the same features under their own letter: `w` wind, `r` rain,
 * `s` snow. An hour with no forecast (Unknown) has no property, so it reads
 * as null.
 */
import type { FeatureCollection, Point } from 'geojson'

import type { Heatmap } from '../../api/schema'
import type { HeatmapMetric } from '../../state/ui'

const PREFIX: Readonly<Record<HeatmapMetric, string>> = {
  risk: 'h',
  wind: 'w',
  rain: 'r',
  snow: 's',
}

/** The feature property holding `metric`'s level at `hour`. */
export function heatmapProperty(metric: HeatmapMetric, hour: number): string {
  return `${PREFIX[metric]}${String(hour)}`
}

/** Property (`h14`, `w14`, …) → level 0 (Low) … 4 (No travel). */
export type HeatmapCell = Record<string, number>

type LevelGrid = readonly (readonly (number | null)[])[]

export function buildHeatmapGeometry(heatmap: Heatmap): FeatureCollection<Point, HeatmapCell> {
  const grids: [HeatmapMetric, LevelGrid][] = [['risk', heatmap.risk]]
  if (heatmap.metrics) {
    const { wind, rain, snow } = heatmap.metrics
    grids.push(['wind', wind], ['rain', rain], ['snow', snow])
  }
  return {
    type: 'FeatureCollection',
    features: heatmap.points.map((point, i) => {
      const cell: HeatmapCell = {}
      for (const [metric, grid] of grids) {
        grid[i]?.forEach((level, hour) => {
          if (level !== null) cell[heatmapProperty(metric, hour)] = level
        })
      }
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

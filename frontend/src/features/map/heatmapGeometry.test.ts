import { describe, expect, it } from 'vitest'

import type { Heatmap } from '../../api/schema'
import { demoHeatmap } from '../../test/fixtures/demoHeatmap'
import { buildHeatmapGeometry, meanLatitude } from './heatmapGeometry'

const tiny = {
  start_hour: '2026-10-12T15:00:00Z',
  hours: 3,
  cell_deg: 0.5,
  stale: false,
  forecast_as_of: '2026-10-12T14:00:00Z',
  points: [
    [-100, 32],
    [-99.5, 34],
  ],
  risk: [
    [0, 2, 4],
    [1, null, 3],
  ],
} satisfies Heatmap

describe('heatmap geometry', () => {
  it('is a point per grid cell, at its [lon, lat]', () => {
    const { features } = buildHeatmapGeometry(tiny)

    expect(features.map((f) => f.geometry.coordinates)).toEqual([
      [-100, 32],
      [-99.5, 34],
    ])
  })

  it('holds each hour as a flat property, leaving out hours with no forecast', () => {
    const { features } = buildHeatmapGeometry(tiny)

    expect(features.map((f) => f.properties)).toEqual([
      { h0: 0, h1: 2, h2: 4 },
      { h0: 1, h2: 3 },
    ])
  })

  it('gives the real response all 49 hours, h0 to h48', () => {
    const { features } = buildHeatmapGeometry(demoHeatmap)

    expect(features).toHaveLength(demoHeatmap.points.length)
    expect(Object.keys(features[0]?.properties ?? {})).toEqual(
      Array.from({ length: 49 }, (_, h) => `h${String(h)}`),
    )
  })

  it('finds the mean latitude', () => {
    expect(meanLatitude(tiny)).toBe(33)
    expect(meanLatitude({ ...tiny, points: [], risk: [] })).toBe(0)
  })
})

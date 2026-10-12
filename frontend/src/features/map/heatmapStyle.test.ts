/**
 * The heatmap's expressions, checked with MapLibre's own style-spec: valid
 * as paint, and evaluated the way the map evaluates them.
 */
import {
  Color,
  createExpression,
  latest,
  validateStyleMin,
  type ExpressionSpecification,
  type StylePropertySpecification,
} from '@maplibre/maplibre-gl-style-spec'
import { describe, expect, it } from 'vitest'

import { RISK, RISK_LEVELS } from '../../lib/risk'
import {
  HEATMAP_OPACITY,
  heatmapColor,
  heatmapIntensity,
  heatmapRadius,
  heatmapWeight,
} from './layers'

type HeatmapPaint = keyof typeof latest.paint_heatmap

function evaluate(
  property: HeatmapPaint,
  expression: ExpressionSpecification,
  globals: { zoom: number; heatmapDensity?: number },
  properties: Record<string, number> = {},
): unknown {
  // The spec's JSON types its `type` fields as plain strings.
  const spec = latest.paint_heatmap[property] as StylePropertySpecification
  const compiled = createExpression(expression, `paint.${property}`, spec)
  if (compiled.result !== 'success') throw new Error(JSON.stringify(compiled.value))
  return compiled.value.evaluate(globals, { type: 'Point', properties, geometry: [] })
}

const weightOf = (level: number | undefined, hour = 7) =>
  evaluate(
    'heatmap-weight',
    heatmapWeight(hour),
    { zoom: 6 },
    level === undefined ? {} : { [`h${String(hour)}`]: level },
  )

const colourAt = (density: number) =>
  evaluate('heatmap-color', heatmapColor, { zoom: 6, heatmapDensity: density })

describe('heatmap weight', () => {
  it('gives each level a fifth of the scale, Low included', () => {
    expect([0, 1, 2, 3, 4].map((level) => weightOf(level))).toEqual([0.2, 0.4, 0.6, 0.8, 1])
  })

  it('gives an hour with no forecast no weight, so Unknown is never drawn as Low', () => {
    expect(weightOf(undefined)).toBe(0)
  })

  it("reads the chosen condition's level", () => {
    const cell = { h3: 0, w3: 4, r3: 1, s3: 2 }
    const weight = (metric: 'risk' | 'wind' | 'rain' | 'snow') =>
      evaluate('heatmap-weight', heatmapWeight(3, metric), { zoom: 6 }, cell)
    expect([weight('risk'), weight('wind'), weight('rain'), weight('snow')]).toEqual([
      0.2, 1, 0.4, 0.6,
    ])
  })

  it('reads the hour it is built for', () => {
    expect(evaluate('heatmap-weight', heatmapWeight(48), { zoom: 6 }, { h47: 4, h48: 0 })).toBe(0.2)
  })
})

describe('heatmap colour', () => {
  it("paints each level's density in that level's colour, as on the checkpoints", () => {
    const colours = RISK_LEVELS.map((_, score) => colourAt(weightOf(score) as number))
    expect(colours).toEqual(RISK_LEVELS.map((level) => Color.parse(RISK[level].color)))
  })

  it('leaves no density uncoloured', () => {
    expect(colourAt(0)).toEqual(Color.parse('rgba(0, 0, 0, 0)'))
  })
})

describe('heatmap kernel', () => {
  // MapLibre's kernel: weight × intensity × GAUSS_COEF × exp(-4.5 (d / radius)²).
  const GAUSS_COEF = 0.3989422804014327
  const PX_PER_DEGREE = (zoom: number) => (512 / 360) * 2 ** zoom

  /** Density at an offset (in grid steps) from a cell, on a uniform grid of one weight. */
  function density(zoom: number, latitude: number, offset: [number, number], cellDeg = 0.25) {
    const radius = evaluate('heatmap-radius', heatmapRadius(cellDeg), { zoom }) as number
    const intensity = heatmapIntensity(latitude)
    const column = cellDeg * PX_PER_DEGREE(zoom)
    const row = column / Math.cos((latitude * Math.PI) / 180)
    let sum = 0
    for (let i = -12; i <= 12; i++) {
      for (let j = -12; j <= 12; j++) {
        const dx = (i + offset[0]) * column
        const dy = (j + offset[1]) * row
        sum += intensity * GAUSS_COEF * Math.exp(-4.5 * ((dx * dx + dy * dy) / radius ** 2))
      }
    }
    return sum
  }

  // Within 0.05: the colour bands are 0.1 either side of each level's weight,
  // so a cell inside a region of one level always shows that level's colour.
  it.each([4, 6, 8, 10])('makes density equal weight on and between cells at zoom %i', (zoom) => {
    for (const latitude of [30, 36, 42]) {
      for (const offset of [
        [0, 0],
        [0.5, 0],
        [0, 0.5],
        [0.5, 0.5],
      ] as [number, number][]) {
        expect(density(zoom, latitude, offset)).toBeCloseTo(1, 1)
      }
    }
  })

  it('scales the radius with the grid step', () => {
    const at6 = (cellDeg: number) =>
      evaluate('heatmap-radius', heatmapRadius(cellDeg), { zoom: 6 }) as number
    expect(at6(0.5)).toBeCloseTo(2 * at6(0.25))
    expect(evaluate('heatmap-radius', heatmapRadius(0.25), { zoom: 7 })).toBeCloseTo(2 * at6(0.25))
  })
})

describe('heatmap paint', () => {
  it('is a valid MapLibre heatmap layer', () => {
    const errors = validateStyleMin({
      version: 8,
      sources: { heatmap: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
      layers: [
        {
          id: 'corridor-heat',
          type: 'heatmap',
          source: 'heatmap',
          paint: {
            'heatmap-weight': heatmapWeight(0),
            'heatmap-radius': heatmapRadius(0.25),
            'heatmap-intensity': heatmapIntensity(36),
            'heatmap-color': heatmapColor,
            'heatmap-opacity': HEATMAP_OPACITY,
            'heatmap-opacity-transition': { duration: 600, delay: 0 },
          },
        },
      ],
    })
    expect(errors).toEqual([])
  })
})

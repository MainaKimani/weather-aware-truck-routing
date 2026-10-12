/**
 * Map layer ids and styling. Colours come from lib/risk.ts, the one place
 * risk colours are defined, so a checkpoint, a route segment and a table chip
 * always agree.
 */
import type { ExpressionSpecification } from 'maplibre-gl'

import { RISK } from '../../lib/risk'
import type { HeatmapMetric } from '../../state/ui'
import { heatmapProperty } from './heatmapGeometry'

export const SOURCE = {
  heatmap: 'heatmap',
  routes: 'routes',
  segments: 'route-segments',
  checkpoints: 'checkpoints',
} as const

export const LAYER = {
  heatmap: 'corridor-heat',
  otherRoutes: 'routes-other',
  routeCasing: 'route-casing',
  routeSegments: 'route-segments',
  /** Wide and invisible, so a 4 px line is easy to point at. */
  routeHit: 'route-hit',
  checkpoints: 'checkpoints',
} as const

/** Layers whose features the pointer can hover and click. */
export const INTERACTIVE_LAYERS: string[] = [LAYER.checkpoints, LAYER.routeHit]

/** A colour per risk level, read from a feature's `level` property. */
export const riskColor: ExpressionSpecification = [
  'match',
  ['get', 'level'],
  'LOW',
  RISK.LOW.color,
  'MODERATE',
  RISK.MODERATE.color,
  'HIGH',
  RISK.HIGH.color,
  'SEVERE',
  RISK.SEVERE.color,
  'NO_TRAVEL',
  RISK.NO_TRAVEL.color,
  RISK.UNKNOWN.color,
]

/** True for features of route `routeId` ('' matches none). */
export function routeIs(routeId: string): ExpressionSpecification {
  return ['==', ['get', 'route'], routeId]
}

/** A hovered or selected checkpoint is drawn larger, with a heavier outline. */
const emphasised: ExpressionSpecification = [
  'any',
  ['boolean', ['feature-state', 'hover'], false],
  ['boolean', ['feature-state', 'selected'], false],
]

/** Checkpoint radius by zoom: small dots across a state, clear circles along a road. */
export const checkpointRadius: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4,
  ['case', emphasised, 6, 3],
  8,
  ['case', emphasised, 9, 5],
  12,
  ['case', emphasised, 12, 8],
]

export const checkpointStroke: ExpressionSpecification = ['case', emphasised, 2.5, 1]

export interface RouteInk {
  other: string
  otherHover: string
  casing: string
}

/**
 * Route line colours from the theme's tokens (`--map-*` in index.css). The
 * map can't use CSS variables, so their values are read when the theme
 * changes; call this after the theme has been applied to <html>.
 */
export function readRouteInk(root: HTMLElement = document.documentElement): RouteInk {
  const style = getComputedStyle(root)
  const token = (name: string) => style.getPropertyValue(name).trim()
  return {
    other: token('--map-route'),
    otherHover: token('--map-route-hover'),
    casing: token('--map-casing'),
  }
}

// --- Heatmap (RFC §10.4) ----------------------------------------------------
//
// The grid is uniform, so with the right kernel the heatmap's density at a
// cell equals that cell's weight, and the colour can be read straight from
// it. Each level gets a fifth of the density scale, Low included (it is a
// level, and shows pale yellow as on the checkpoints); Unknown weighs
// nothing, so missing data is left uncoloured rather than shown as Low.

/** Density of each level of `metric` at `hour`: Low 0.2 … No travel 1.0; Unknown 0. */
export function heatmapWeight(
  hour: number,
  metric: HeatmapMetric = 'risk',
): ExpressionSpecification {
  return ['/', ['+', ['coalesce', ['get', heatmapProperty(metric, hour)], -1], 1], 5]
}

/** Density back to the level's colour, in steps, so each band is one legend colour. */
export const heatmapColor: ExpressionSpecification = [
  'step',
  ['heatmap-density'],
  'rgba(0, 0, 0, 0)',
  0.1,
  RISK.LOW.color,
  0.3,
  RISK.MODERATE.color,
  0.5,
  RISK.HIGH.color,
  0.7,
  RISK.SEVERE.color,
  0.9,
  RISK.NO_TRAVEL.color,
]

/** MapLibre's kernel is a Gaussian whose sigma is a third of `heatmap-radius`. */
const SIGMA_PER_RADIUS = 1 / 3
/** Sigma in grid steps: wide enough that neighbouring cells merge with no ripple or gaps. */
const SIGMA_CELLS = 0.6
/** Pixels per degree of longitude at zoom 0 (512 px tiles); doubles with each zoom level. */
const PX_PER_DEGREE_Z0 = 512 / 360
/** The kernel's peak, 1/sqrt(2π), from MapLibre's heatmap shader. */
const GAUSS_PEAK = 1 / Math.sqrt(2 * Math.PI)

/** The radius that keeps the kernel at SIGMA_CELLS grid steps at every zoom. */
export function heatmapRadius(cellDeg: number): ExpressionSpecification {
  const atZoom0 = (SIGMA_CELLS * cellDeg * PX_PER_DEGREE_Z0) / SIGMA_PER_RADIUS
  return ['interpolate', ['exponential', 2], ['zoom'], 0, atZoom0, 24, atZoom0 * 2 ** 24]
}

/**
 * The intensity that makes density equal weight. Summed over a lattice with
 * steps a × b pixels, kernels of sigma σ add up to 2πσ²/(ab) times their
 * peak. Rows are drawn 1/cos(latitude) further apart than columns
 * (Mercator), and σ = SIGMA_CELLS·a, so the zoom cancels out.
 */
export function heatmapIntensity(latitude: number): number {
  const rowStretch = 1 / Math.cos((latitude * Math.PI) / 180)
  return rowStretch / (GAUSS_PEAK * 2 * Math.PI * SIGMA_CELLS ** 2)
}

/** Opacity once shown: the basemap's roads and towns stay readable underneath. */
export const HEATMAP_OPACITY = 0.6

export const visibility = (on: boolean) => (on ? 'visible' : 'none')

export const ROUND_LINE = { 'line-cap': 'round', 'line-join': 'round' } as const

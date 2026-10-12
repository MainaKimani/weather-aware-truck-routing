/**
 * Map layer ids and styling. Colours come from lib/risk.ts, the one place
 * risk colours are defined, so a checkpoint, a route segment and a table chip
 * always agree.
 */
import type { ExpressionSpecification } from 'maplibre-gl'

import { RISK } from '../../lib/risk'

export const SOURCE = {
  routes: 'routes',
  segments: 'route-segments',
} as const

export const LAYER = {
  otherRoutes: 'routes-other',
  routeCasing: 'route-casing',
  routeSegments: 'route-segments',
  /** Wide and invisible, so a 4 px line is easy to point at. */
  routeHit: 'route-hit',
} as const

/** Layers whose features the pointer can hover and click. */
export const INTERACTIVE_LAYERS: string[] = [LAYER.routeHit]

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

export const ROUND_LINE = { 'line-cap': 'round', 'line-join': 'round' } as const

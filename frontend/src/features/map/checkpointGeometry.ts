/**
 * Every route's checkpoints as one point source, built once per plan. Each
 * feature has a numeric id, which MapLibre needs for feature-state (hover and
 * selection highlights without touching the data).
 */
import type { Feature, FeatureCollection, Point } from 'geojson'

import type { Plan } from '../../api/schema'
import type { RiskBucket } from '../../lib/risk'
import type { CheckpointRef } from '../../state/ui'

export interface CheckpointProps {
  route: string
  index: number
  level: RiskBucket
}

export interface CheckpointGeometry {
  data: FeatureCollection<Point, CheckpointProps>
  /** The feature id of a checkpoint, or null if it isn't in this plan. */
  idOf: (ref: CheckpointRef) => number | null
}

export function buildCheckpoints(routes: readonly Plan['routes'][number][]): CheckpointGeometry {
  const features: Feature<Point, CheckpointProps>[] = []
  const firstId = new Map<string, number>()
  const counts = new Map<string, number>()

  for (const route of routes) {
    firstId.set(route.id, features.length)
    counts.set(route.id, route.checkpoints.length)
    route.checkpoints.forEach((cp, index) => {
      features.push({
        type: 'Feature',
        id: features.length,
        geometry: { type: 'Point', coordinates: [cp.lon, cp.lat] },
        properties: { route: route.id, index, level: cp.risk.level ?? 'UNKNOWN' },
      })
    })
  }

  return {
    data: { type: 'FeatureCollection', features },
    idOf: ({ routeId, index }) => {
      const first = firstId.get(routeId)
      const count = counts.get(routeId) ?? 0
      return first === undefined || index < 0 || index >= count ? null : first + index
    },
  }
}

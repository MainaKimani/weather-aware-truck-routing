import { useEffect } from 'react'
import { useMap } from 'react-map-gl/maplibre'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { prefersReducedMotion } from '../../lib/motion'
import { FIT_MAX_ZOOM, fitPadding } from './basemap'

// A new object per plan (generated_at differs), the same object otherwise,
// because query results are structurally shared.
const selectFrame = (plan: Plan) => ({ generatedAt: plan.generated_at, bbox: plan.corridor.bbox })

/** Fits the camera to every route each time a plan arrives. Renders nothing. */
export function Camera() {
  const { current: map } = useMap()
  const frame = usePlan(selectFrame)

  useEffect(() => {
    if (!map || !frame) return
    const [west, south, east, north] = frame.bbox
    if (west === undefined || south === undefined || east === undefined || north === undefined) {
      return
    }
    const { clientWidth, clientHeight } = map.getContainer()
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      {
        padding: fitPadding(clientWidth, clientHeight),
        maxZoom: FIT_MAX_ZOOM,
        duration: prefersReducedMotion() ? 0 : 800,
      },
    )
  }, [map, frame])

  return null
}

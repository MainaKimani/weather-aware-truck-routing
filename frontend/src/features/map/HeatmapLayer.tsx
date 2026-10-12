/**
 * The corridor heatmap (RFC §10.3 layer 1, §10.4): risk around the routes at
 * the slider's hour, under the routes.
 *
 * The data is built once per heatmap. Moving the slider sets one paint
 * property from outside React, at most once a frame: nothing re-renders and
 * nothing is re-uploaded. The layer fades in when the heatmap arrives, which
 * is after the routes are drawn.
 */
import { useEffect, useMemo, useState } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'

import { useHeatmap } from '../../api/heatmap'
import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { prefersReducedMotion } from '../../lib/motion'
import { useTimelineStore } from '../../state/timeline'
import { useUiStore } from '../../state/ui'
import { buildHeatmapGeometry, meanLatitude } from './heatmapGeometry'
import {
  HEATMAP_OPACITY,
  LAYER,
  SOURCE,
  heatmapColor,
  heatmapIntensity,
  heatmapRadius,
  heatmapWeight,
  visibility,
} from './layers'

const FADE_MS = 600

const selectTripId = (plan: Plan) => plan.trip_id

export function HeatmapLayer() {
  const tripId = usePlan(selectTripId)
  const { data: heatmap } = useHeatmap(tripId)
  const geometry = useMemo(() => (heatmap ? buildHeatmapGeometry(heatmap) : null), [heatmap])
  const on = useUiStore((s) => s.layers.heatmap)
  const shown = useShownAfterFirstFrame(geometry)
  useHourOnMap(geometry !== null)
  if (!heatmap || !geometry) return null

  return (
    <Source id={SOURCE.heatmap} type="geojson" data={geometry}>
      <Layer
        id={LAYER.heatmap}
        type="heatmap"
        beforeId={LAYER.otherRoutes}
        layout={{ visibility: visibility(on) }}
        paint={{
          // The hour as of this render; the slider then updates it directly (useHourOnMap).
          'heatmap-weight': heatmapWeight(useTimelineStore.getState().hour),
          'heatmap-radius': heatmapRadius(heatmap.cell_deg),
          'heatmap-intensity': heatmapIntensity(meanLatitude(heatmap)),
          'heatmap-color': heatmapColor,
          'heatmap-opacity': shown ? HEATMAP_OPACITY : 0,
          'heatmap-opacity-transition': {
            duration: prefersReducedMotion() ? 0 : FADE_MS,
            delay: 0,
          },
        }}
      />
    </Source>
  )
}

/**
 * False for the first frame after `value` appears, then true, so the layer is
 * added transparent and its opacity then transitions in.
 */
function useShownAfterFirstFrame(value: unknown): boolean {
  const [shownFor, setShownFor] = useState<unknown>(null)
  useEffect(() => {
    if (value === null) return
    const frame = requestAnimationFrame(() => {
      setShownFor(value)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [value])
  return value !== null && shownFor === value
}

/** Keeps the layer's weight on the slider's hour, once a frame at most, without rendering. */
function useHourOnMap(active: boolean) {
  const { current: map } = useMap()

  useEffect(() => {
    if (!map || !active) return
    let frame: number | null = null
    const unsubscribe = useTimelineStore.subscribe((state, previous) => {
      if (state.hour === previous.hour || frame !== null) return
      frame = requestAnimationFrame(() => {
        frame = null
        if (map.getLayer(LAYER.heatmap)) {
          const { hour } = useTimelineStore.getState()
          // MapRef leaves out setters, as React owns the props; this one is ours on purpose.
          map.getMap().setPaintProperty(LAYER.heatmap, 'heatmap-weight', heatmapWeight(hour))
        }
      })
    })
    return () => {
      unsubscribe()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [map, active])
}

/**
 * The corridor heatmap (RFC §10.3 layer 1, §10.4): risk around the routes at
 * the slider's hour, under the routes.
 *
 * The data is built once per heatmap. Moving the slider sets one paint
 * property from outside React, at most once a frame: nothing re-renders and
 * nothing is re-uploaded. The layer fades in when the heatmap arrives, which
 * is after the routes are drawn.
 *
 * It colours by the overall rating or by one condition (the legend's
 * choice). The first time a condition is chosen, the heatmap with every
 * condition's levels is fetched and its data replaces the plain one, once;
 * until it arrives the rating stays on show. After that, switching is a
 * paint change like the slider's.
 */
import { useEffect, useMemo, useState } from 'react'
import { Layer, Source, useMap } from 'react-map-gl/maplibre'

import { useHeatmap } from '../../api/heatmap'
import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { prefersReducedMotion } from '../../lib/motion'
import { useTimelineStore } from '../../state/timeline'
import { useUiStore, type HeatmapMetric } from '../../state/ui'
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
  const metric = useUiStore((s) => s.heatmapMetric)
  const plain = useHeatmap(tripId)
  // Requested once a condition is chosen; read from the cache after that.
  const full = useHeatmap(tripId, { metrics: true, enabled: metric !== 'risk' })
  const heatmap = full.data ?? plain.data
  const geometry = useMemo(() => (heatmap ? buildHeatmapGeometry(heatmap) : null), [heatmap])
  const shownMetric: HeatmapMetric = heatmap?.metrics ? metric : 'risk'
  const on = useUiStore((s) => s.layers.heatmap)
  // Fades in once per trip, not again when the conditions' data replaces the plain data.
  const shown = useShownAfterFirstFrame(geometry ? (tripId ?? null) : null)
  useHourOnMap(geometry !== null, shownMetric)
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
          'heatmap-weight': heatmapWeight(useTimelineStore.getState().hour, shownMetric),
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
function useHourOnMap(active: boolean, metric: HeatmapMetric) {
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
          const weight = heatmapWeight(hour, metric)
          map.getMap().setPaintProperty(LAYER.heatmap, 'heatmap-weight', weight)
        }
      })
    })
    return () => {
      unsubscribe()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [map, active, metric])
}

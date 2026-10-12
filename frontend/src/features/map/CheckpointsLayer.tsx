/**
 * The selected route's checkpoints (RFC §10.3, layer 4): one circle layer
 * over one source holding every route's checkpoints, coloured by level.
 * Selecting another route changes the filter; hover and selection set
 * feature-state, so neither re-sends the data.
 */
import { useEffect, useMemo } from 'react'
import { Layer, Source, useMap, type MapSourceDataEvent } from 'react-map-gl/maplibre'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import type { Theme } from '../../lib/theme'
import { useUiStore, type CheckpointRef } from '../../state/ui'
import { buildCheckpoints, type CheckpointGeometry } from './checkpointGeometry'
import {
  LAYER,
  SOURCE,
  checkpointRadius,
  checkpointStroke,
  readRouteInk,
  riskColor,
  routeIs,
} from './layers'

const selectRoutes = (plan: Plan) => plan.routes

export function CheckpointsLayer({ theme }: { theme: Theme }) {
  const routes = usePlan(selectRoutes)
  const geometry = useMemo(() => (routes ? buildCheckpoints(routes) : null), [routes])
  const selected = useUiStore((s) => s.selectedRouteId) ?? ''
  // Read only when the theme changes, as in RoutesLayer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ink = useMemo(() => readRouteInk(), [theme])
  if (!geometry) return null

  return (
    <>
      <Source id={SOURCE.checkpoints} type="geojson" data={geometry.data}>
        <Layer
          id={LAYER.checkpoints}
          type="circle"
          filter={routeIs(selected)}
          paint={{
            'circle-color': riskColor,
            'circle-radius': checkpointRadius,
            'circle-stroke-color': ink.casing,
            'circle-stroke-width': checkpointStroke,
          }}
        />
      </Source>
      <Highlight geometry={geometry} />
    </>
  )
}

/** Mirrors the hovered and selected checkpoints into feature-state. Renders nothing. */
function Highlight({ geometry }: { geometry: CheckpointGeometry }) {
  const hovered = useUiStore((s) => s.hoveredCheckpoint)
  const selected = useUiStore((s) => s.selectedCheckpoint)
  useFeatureState(geometry, hovered, 'hover')
  useFeatureState(geometry, selected, 'selected')
  return null
}

function useFeatureState(
  geometry: CheckpointGeometry,
  ref: CheckpointRef | null,
  key: 'hover' | 'selected',
) {
  const { current: map } = useMap()

  useEffect(() => {
    const id = ref ? geometry.idOf(ref) : null
    if (!map || id === null) return
    const target = { source: SOURCE.checkpoints, id }
    const apply = () => {
      if (map.getSource(SOURCE.checkpoints)) map.setFeatureState(target, { [key]: true })
    }
    // A new basemap (theme change) re-adds the source without its feature-state.
    const reapply = (event: MapSourceDataEvent) => {
      if (event.sourceId === SOURCE.checkpoints && event.sourceDataType === 'metadata') apply()
    }
    apply()
    map.on('sourcedata', reapply)
    return () => {
      map.off('sourcedata', reapply)
      if (map.getSource(SOURCE.checkpoints)) map.removeFeatureState(target, key)
    }
  }, [map, geometry, ref, key])
}

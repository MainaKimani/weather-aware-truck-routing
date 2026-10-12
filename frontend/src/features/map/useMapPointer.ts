/**
 * Hover and click on the map, written to the same store the panel uses, so
 * pointing at a route or checkpoint on the map highlights its card or table
 * row, and the reverse.
 */
import { useState } from 'react'
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'

import { useUiStore, type CheckpointRef } from '../../state/ui'
import { LAYER } from './layers'

type PointerFeature = Pick<
  NonNullable<MapLayerMouseEvent['features']>[number],
  'layer' | 'properties'
>

export type MapTarget =
  { kind: 'route'; routeId: string } | { kind: 'checkpoint'; ref: CheckpointRef } | null

/** What the pointer is on: a checkpoint before the route beneath it. */
export function targetOf(features: readonly PointerFeature[] | undefined): MapTarget {
  let route: MapTarget = null
  for (const feature of features ?? []) {
    const { route: routeId, index } = feature.properties as Record<string, unknown>
    if (typeof routeId !== 'string') continue
    if (feature.layer.id === LAYER.checkpoints && typeof index === 'number') {
      return { kind: 'checkpoint', ref: { routeId, index } }
    }
    if (feature.layer.id === LAYER.routeHit) route ??= { kind: 'route', routeId }
  }
  return route
}

const sameRef = (a: CheckpointRef | null, b: CheckpointRef | null) =>
  a?.routeId === b?.routeId && a?.index === b?.index

export function useMapPointer() {
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const point = (target: MapTarget) => {
    const ui = useUiStore.getState()
    const checkpoint = target?.kind === 'checkpoint' ? target.ref : null
    // Only on change: a new ref object would re-run every highlight effect on each mouse move.
    if (!sameRef(ui.hoveredCheckpoint, checkpoint)) ui.hoverCheckpoint(checkpoint)
    ui.hoverRoute(
      target === null ? null : target.kind === 'route' ? target.routeId : target.ref.routeId,
    )
    setCursor(target ? 'pointer' : undefined)
  }

  return {
    cursor,
    onMouseMove: (event: MapLayerMouseEvent) => {
      point(targetOf(event.features))
    },
    onMouseOut: () => {
      point(null)
    },
    onClick: (event: MapLayerMouseEvent) => {
      const target = targetOf(event.features)
      const ui = useUiStore.getState()
      if (target?.kind === 'checkpoint') ui.selectCheckpoint(target.ref)
      else if (target?.kind === 'route') ui.selectRoute(target.routeId)
      // A click on empty map closes the checkpoint popup and keeps the route.
      else ui.selectCheckpoint(null)
    },
  }
}

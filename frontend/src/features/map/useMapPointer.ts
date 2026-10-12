/**
 * Hover and click on the map, written to the same store the panel uses, so
 * pointing at a route on the map highlights its card and the reverse.
 */
import { useState } from 'react'
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre'

import { useUiStore } from '../../state/ui'
import { LAYER } from './layers'

type PointerFeature = Pick<
  NonNullable<MapLayerMouseEvent['features']>[number],
  'layer' | 'properties'
>

export type MapTarget = { kind: 'route'; routeId: string } | null

/** What the pointer is on: the topmost interactive feature under it. */
export function targetOf(features: readonly PointerFeature[] | undefined): MapTarget {
  for (const feature of features ?? []) {
    const route: unknown = feature.properties.route
    if (feature.layer.id === LAYER.routeHit && typeof route === 'string') {
      return { kind: 'route', routeId: route }
    }
  }
  return null
}

export function useMapPointer() {
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const point = (target: MapTarget) => {
    useUiStore.getState().hoverRoute(target?.kind === 'route' ? target.routeId : null)
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
      if (target?.kind === 'route') useUiStore.getState().selectRoute(target.routeId)
    },
  }
}

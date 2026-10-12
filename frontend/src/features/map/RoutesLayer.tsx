/**
 * The routes (RFC §10.3, layers 2-3). Other routes are grey; the selected one
 * is drawn in risk-coloured segments over a casing.
 *
 * The data is built once per plan. Selecting or hovering a route, from the
 * map or from a route card (both write `state/ui.ts`), changes only filters
 * and paint, never the data, so nothing is re-uploaded to the GPU.
 */
import { useMemo } from 'react'
import { Layer, Source } from 'react-map-gl/maplibre'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import type { Theme } from '../../lib/theme'
import { useUiStore } from '../../state/ui'
import { LAYER, ROUND_LINE, SOURCE, readRouteInk, riskColor, routeIs, visibility } from './layers'
import { buildRouteGeometry } from './routeGeometry'

const selectRoutes = (plan: Plan) => plan.routes

export function RoutesLayer({ theme }: { theme: Theme }) {
  const routes = usePlan(selectRoutes)
  const geometry = useMemo(() => (routes ? buildRouteGeometry(routes) : null), [routes])
  // '' matches no route, so nothing is drawn as selected or hovered.
  const selected = useUiStore((s) => s.selectedRouteId) ?? ''
  const hovered = useUiStore((s) => s.hoveredRouteId) ?? ''
  const showOthers = useUiStore((s) => s.layers.alternatives)
  // The tokens are read only when the theme changes (it is applied to <html>
  // before React re-renders), not on every hover.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ink = useMemo(() => readRouteInk(), [theme])
  if (!geometry) return null

  const isSelected = routeIs(selected)
  const isHovered = routeIs(hovered)

  return (
    <>
      <Source id={SOURCE.routes} type="geojson" data={geometry.lines}>
        <Layer
          id={LAYER.otherRoutes}
          type="line"
          filter={['!', isSelected]}
          layout={{ ...ROUND_LINE, visibility: visibility(showOthers) }}
          paint={{
            'line-color': ['case', isHovered, ink.otherHover, ink.other],
            'line-width': ['case', isHovered, 5, 4],
          }}
        />
        <Layer
          id={LAYER.routeCasing}
          type="line"
          filter={isSelected}
          layout={ROUND_LINE}
          paint={{ 'line-color': ink.casing, 'line-width': 10 }}
        />
      </Source>
      <Source id={SOURCE.segments} type="geojson" data={geometry.segments}>
        <Layer
          id={LAYER.routeSegments}
          type="line"
          filter={isSelected}
          layout={ROUND_LINE}
          paint={{ 'line-color': riskColor, 'line-width': 6 }}
        />
        <Layer
          id={LAYER.routeHit}
          type="line"
          // Hidden routes can't be pointed at either.
          filter={showOthers ? true : isSelected}
          layout={ROUND_LINE}
          paint={{ 'line-color': 'black', 'line-opacity': 0, 'line-width': 16 }}
        />
      </Source>
    </>
  )
}

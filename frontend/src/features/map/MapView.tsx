/**
 * The map (RFC §10.3). MapLibre draws on WebGL, so hundreds of checkpoints
 * and the routes stay smooth while panning; everything drawn on it comes
 * from the plan in the query cache and the shared UI store.
 *
 * Loaded on demand: MapLibre is the largest dependency, and the form and
 * results don't need it to appear.
 */
import 'maplibre-gl/dist/maplibre-gl.css'

// MapLibre looks for its worker beside its own module, which Vite's bundling
// moves; building the worker here and passing its URL works in dev and build.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

import { useState } from 'react'
import { Map, NavigationControl, type ErrorEvent } from 'react-map-gl/maplibre'

import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { useTheme } from '../../lib/theme'
import { BASEMAP, INITIAL_VIEW } from './basemap'
import { Camera } from './Camera'
import { PlaceMarkers } from './PlaceMarkers'

// react-map-gl reports a map that couldn't start (no WebGL, say) as an error
// with no target; later errors, such as a tile that didn't load, have one.
function failedToStart(event: ErrorEvent): boolean {
  return (event.target as ErrorEvent['target'] | null) === null
}

const hasPlan = (plan: Plan) => plan.routes.length > 0

export default function MapView() {
  const { theme } = useTheme()
  const planned = usePlan(hasPlan) ?? false
  const [unavailable, setUnavailable] = useState(false)

  if (unavailable) return <MapUnavailable />

  return (
    <div className="absolute inset-0">
      <Map
        workerUrl={workerUrl}
        initialViewState={INITIAL_VIEW}
        mapStyle={BASEMAP[theme]}
        dragRotate={false}
        touchPitch={false}
        pitchWithRotate={false}
        attributionControl={{ compact: true }}
        onError={(event) => {
          if (failedToStart(event)) setUnavailable(true)
        }}
      >
        <NavigationControl position="top-right" showCompass={false} />
        <Camera />
        <PlaceMarkers />
      </Map>
      {!planned && (
        <p className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-3 py-1 text-xs text-muted shadow-overlay">
          Routes appear here once a trip is planned.
        </p>
      )}
    </div>
  )
}

function MapUnavailable() {
  return (
    <div
      role="status"
      className="flex h-full items-center justify-center bg-canvas p-6 text-center text-sm text-muted"
    >
      The map couldn't start in this browser (it needs WebGL). Routes and checkpoints are still
      listed in the panel.
    </div>
  )
}

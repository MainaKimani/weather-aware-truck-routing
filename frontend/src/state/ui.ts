/**
 * What the user is pointing at and which layers are on: client-only state
 * shared by the routes panel, checkpoint table and map.
 *
 * Components subscribe with a selector (`useUiStore((s) => s.selectedRouteId)`),
 * so hovering a checkpoint re-renders only what shows the hover.
 */
import { create } from 'zustand'

export interface CheckpointRef {
  routeId: string
  index: number
}

export type Layer = 'heatmap' | 'checkpoints' | 'alternatives'

interface UiState {
  selectedRouteId: string | null
  hoveredRouteId: string | null
  selectedCheckpoint: CheckpointRef | null
  hoveredCheckpoint: CheckpointRef | null
  layers: Readonly<Record<Layer, boolean>>
  selectRoute: (routeId: string | null) => void
  hoverRoute: (routeId: string | null) => void
  selectCheckpoint: (checkpoint: CheckpointRef | null) => void
  hoverCheckpoint: (checkpoint: CheckpointRef | null) => void
  toggleLayer: (layer: Layer) => void
  /** A new plan arrived: select its recommended route and clear pointers into the old one. */
  showPlan: (routeId: string | null) => void
}

const initial = {
  selectedRouteId: null,
  hoveredRouteId: null,
  selectedCheckpoint: null,
  hoveredCheckpoint: null,
  layers: { heatmap: true, checkpoints: true, alternatives: true },
} satisfies Partial<UiState>

export const useUiStore = create<UiState>()((set) => ({
  ...initial,
  selectRoute: (routeId) => {
    set((s) =>
      s.selectedRouteId === routeId ? s : { selectedRouteId: routeId, selectedCheckpoint: null },
    )
  },
  hoverRoute: (routeId) => {
    set({ hoveredRouteId: routeId })
  },
  selectCheckpoint: (checkpoint) => {
    set(
      checkpoint
        ? { selectedCheckpoint: checkpoint, selectedRouteId: checkpoint.routeId }
        : { selectedCheckpoint: null },
    )
  },
  hoverCheckpoint: (checkpoint) => {
    set({ hoveredCheckpoint: checkpoint })
  },
  toggleLayer: (layer) => {
    set((s) => ({ layers: { ...s.layers, [layer]: !s.layers[layer] } }))
  },
  showPlan: (routeId) => {
    set({ ...initial, layers: useUiStore.getState().layers, selectedRouteId: routeId })
  },
}))

/** For tests: back to the state a fresh page starts with. */
export function resetUiStore(): void {
  useUiStore.setState(initial)
}

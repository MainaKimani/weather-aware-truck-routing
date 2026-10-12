/**
 * The heatmap timeline: which forecast hour (0-48 from now) is shown.
 *
 * Kept apart from the rest of the UI state on purpose: dragging the slider
 * changes the hour up to 60 times a second, and only the slider and the
 * heatmap should notice. The map layer can subscribe outside React
 * (`useTimelineStore.subscribe`) and update a paint property without
 * rendering anything (RFC §10.4).
 */
import { create } from 'zustand'

export const MAX_HOUR = 48

interface TimelineState {
  hour: number
  playing: boolean
  setHour: (hour: number) => void
  step: (by: number) => void
  setPlaying: (playing: boolean) => void
}

function clamp(hour: number): number {
  return Math.min(MAX_HOUR, Math.max(0, Math.round(hour)))
}

export const useTimelineStore = create<TimelineState>()((set) => ({
  hour: 0,
  playing: false,
  setHour: (hour) => {
    set({ hour: clamp(hour) })
  },
  step: (by) => {
    set((s) => ({ hour: clamp(s.hour + by) }))
  },
  setPlaying: (playing) => {
    set({ playing })
  },
}))

export function resetTimelineStore(): void {
  useTimelineStore.setState({ hour: 0, playing: false })
}

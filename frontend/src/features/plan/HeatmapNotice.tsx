/**
 * Tells the user the heatmap is on its way. On the free hosting it can take
 * several seconds after the routes appear, and without a word the map would
 * just look incomplete. A toast in the top right says it's being generated,
 * and goes once the heatmap arrives (or fails, which the map handles by
 * leaving it out); the user can also close it.
 *
 * It waits SHOW_AFTER_MS first, so a heatmap that's already saved (about a
 * second to load) doesn't flash a message.
 */
import { useEffect } from 'react'

import { useHeatmap } from '../../api/heatmap'
import { usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { useToastStore } from '../../state/toasts'

export const SHOW_AFTER_MS = 1500
export const HEATMAP_NOTICE =
  'Generating the weather heatmap for this trip. It will appear on the map shortly.'

const selectTripId = (plan: Plan) => (plan.routes.length > 0 ? plan.trip_id : undefined)

export function HeatmapNotice() {
  const tripId = usePlan(selectTripId)
  // The same query the heatmap layer uses, so this makes no request of its own.
  const { isPending } = useHeatmap(tripId)
  const waiting = tripId !== undefined && isPending

  useEffect(() => {
    if (!waiting) return
    const { show, dismiss } = useToastStore.getState()
    let id: number | null = null
    const timer = setTimeout(() => {
      id = show(HEATMAP_NOTICE, { placement: 'top-right', durationMs: null })
    }, SHOW_AFTER_MS)
    return () => {
      clearTimeout(timer)
      if (id !== null) dismiss(id)
    }
  }, [waiting, tripId])

  return null
}

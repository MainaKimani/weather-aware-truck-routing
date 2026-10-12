import type { ReactNode } from 'react'

interface PlannerShellProps {
  /** Left pane: trip form above the route results. */
  panel: ReactNode
  /** Right pane: the map and its overlays. */
  map: ReactNode
  /** Bottom bar: the heatmap timeline. */
  timeline: ReactNode
}

/**
 * The planner layout: a scrollable left panel beside a full-height map, and
 * the timeline bar along the bottom. On narrow screens the map goes on top
 * and the panel scrolls below it.
 */
export function PlannerShell({ panel, map, timeline }: PlannerShellProps) {
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col-reverse md:flex-row">
        <aside
          aria-label="Trip planner"
          className="flex min-h-0 flex-1 flex-col overflow-y-auto border-line bg-surface md:w-[400px] md:flex-none md:border-r"
        >
          {panel}
        </aside>
        <main className="relative min-h-[45dvh] flex-1 md:min-h-0">{map}</main>
      </div>
      <footer aria-label="Forecast timeline" className="shrink-0 border-t border-line bg-surface">
        {timeline}
      </footer>
    </>
  )
}

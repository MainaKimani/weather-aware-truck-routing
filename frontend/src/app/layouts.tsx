/**
 * The page layouts. The planner pages share one, so moving between them
 * keeps the map mounted; the rest share a plain page layout.
 */
import { lazy, Suspense } from 'react'
import { Outlet } from 'react-router'

import { MapPlaceholder } from '../features/map/MapPlaceholder'
import { DemoBadge } from '../features/plan/DemoBadge'
import { HeatmapNotice } from '../features/plan/HeatmapNotice'
import { AppShell } from '../features/shell/AppShell'
import { PageShell } from '../features/shell/PageShell'
import { PlannerShell } from '../features/shell/PlannerShell'
import { HourSlider } from '../features/timeline/HourSlider'

const MapView = lazy(() => import('../features/map/MapView'))

export function Root() {
  return (
    <AppShell badges={<DemoBadge />}>
      <Outlet />
    </AppShell>
  )
}

export function PlannerLayout() {
  return (
    <PlannerShell
      panel={<Outlet />}
      map={
        <Suspense fallback={<MapPlaceholder />}>
          <MapView />
        </Suspense>
      }
      timeline={
        <>
          <HourSlider />
          <HeatmapNotice />
        </>
      }
    />
  )
}

export function PageLayout() {
  return (
    <PageShell>
      <Outlet />
    </PageShell>
  )
}

import type { QueryClient } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'

import { AppProviders } from './app/AppProviders'
import { useLatestPlanAttempt, usePlan } from './api/plans'
import type { Plan } from './api/schema'
import { MapPlaceholder } from './features/map/MapPlaceholder'
import { DemoBadge } from './features/plan/DemoBadge'
import { ResultsArea } from './features/plan/ResultsArea'
import { TripForm } from './features/trip-form/TripForm'
import { AppShell } from './features/shell/AppShell'
import { HourSlider } from './features/timeline/HourSlider'

const MapView = lazy(() => import('./features/map/MapView'))

export default function App({ queryClient }: { queryClient?: QueryClient }) {
  return (
    <AppProviders queryClient={queryClient}>
      <AppShell
        badges={<DemoBadge />}
        panel={<Panel />}
        map={
          <Suspense fallback={<MapPlaceholder />}>
            <MapView />
          </Suspense>
        }
        timeline={<HourSlider />}
      />
    </AppProviders>
  )
}

const hasPlan = (plan: Plan) => plan.routes.length > 0

function Panel() {
  const planned = usePlan(hasPlan)
  const attempt = useLatestPlanAttempt()
  return (
    <div className="space-y-5 p-5">
      {!planned && attempt.status === 'idle' && (
        <section aria-labelledby="empty-title">
          <h2 id="empty-title" className="text-lg font-semibold">
            Plan a weather-aware trip
          </h2>
          <p className="mt-2 text-sm text-muted">
            Enter an origin, destination, departure and load. You'll get up to three routes, each
            rated for wind, rain and snow at the time the truck reaches every checkpoint, with a
            recommendation and the reason for it.
          </p>
        </section>
      )}
      <TripForm />
      <ResultsArea />
    </div>
  )
}

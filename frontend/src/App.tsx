import type { QueryClient } from '@tanstack/react-query'

import { AppProviders } from './app/AppProviders'
import { usePlan } from './api/plans'
import type { Plan } from './api/schema'
import { DemoBadge } from './features/plan/DemoBadge'
import { DemoTrip } from './features/plan/DemoTrip'
import { RoutesPanel } from './features/routes-panel/RoutesPanel'
import { AppShell } from './features/shell/AppShell'
import { HourSlider } from './features/timeline/HourSlider'

export default function App({ queryClient }: { queryClient?: QueryClient }) {
  return (
    <AppProviders queryClient={queryClient}>
      <AppShell
        badges={<DemoBadge />}
        panel={<Panel />}
        map={
          <div className="flex h-full items-center justify-center bg-canvas text-sm text-muted">
            The map appears here once a trip is planned.
          </div>
        }
        timeline={<HourSlider />}
      />
    </AppProviders>
  )
}

const hasPlan = (plan: Plan) => plan.routes.length > 0

function Panel() {
  const planned = usePlan(hasPlan)
  return (
    <div className="space-y-5 p-5">
      {!planned && (
        <section aria-labelledby="empty-title">
          <h1 id="empty-title" className="text-lg font-semibold">
            Plan a weather-aware trip
          </h1>
          <p className="mt-2 text-sm text-muted">
            Enter an origin, destination, departure and load. You'll get up to three routes, each
            rated for wind, rain and snow at the time the truck reaches every checkpoint, with a
            recommendation and the reason for it.
          </p>
        </section>
      )}
      <DemoTrip />
      <RoutesPanel />
    </div>
  )
}

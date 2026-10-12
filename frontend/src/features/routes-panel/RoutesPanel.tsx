/** The ranked routes with the recommendation, best first (PRD §7.6). */
import { usePlan } from '../../api/plans'
import { PlanNotices } from './PlanNotices'
import { RouteCard } from './RouteCard'
import { selectContext, selectRoutes } from './selectors'

export function RoutesPanel() {
  const routes = usePlan(selectRoutes)
  const context = usePlan(selectContext)
  if (!routes || !context) return null

  return (
    <section aria-labelledby="routes-title" className="space-y-3">
      <h2 id="routes-title" className="text-sm font-semibold">
        Routes <span className="font-normal text-muted">· best first</span>
      </h2>
      <PlanNotices />
      <ol className="space-y-2">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} context={context} />
        ))}
      </ol>
    </section>
  )
}

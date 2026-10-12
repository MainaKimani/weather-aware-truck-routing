import { act, render } from '@testing-library/react'

import { planKeys } from '../api/plans'
import type { Plan } from '../api/schema'
import { AppProviders } from '../app/AppProviders'
import MapView from '../features/map/MapView'
import { useUiStore } from '../state/ui'
import { freshClient } from './render'

/** The map on the stand-in from fakeMap.tsx, showing `plan` with its recommended route selected. */
export function renderMap(plan?: Plan) {
  const client = freshClient()
  if (plan) showPlan(client, plan)
  const view = render(
    <AppProviders queryClient={client}>
      <MapView />
    </AppProviders>,
  )
  return { client, ...view }
}

/** What a successful plan request does: put the plan in the cache and select its pick. */
export function showPlan(client: ReturnType<typeof freshClient>, plan: Plan): void {
  act(() => {
    client.setQueryData(planKeys.current(), plan)
    useUiStore.getState().showPlan(plan.recommended_route_id ?? plan.routes[0]?.id ?? null)
  })
}

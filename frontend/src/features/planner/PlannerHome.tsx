import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

import { planKeys, useLatestPlanAttempt, usePlan } from '../../api/plans'
import type { Plan } from '../../api/schema'
import { useUiStore } from '../../state/ui'
import { finishSessionEnd, sessionEndedIn } from '../account/sessionHandoff'
import { ResultsArea } from '../plan/ResultsArea'
import { TripForm } from '../trip-form/TripForm'
import { useOpenTrip } from './useOpenTrip'

const hasPlan = (plan: Plan) => plan.routes.length > 0

/** `/`: a new trip. Whatever trip was on screen before is cleared. */
export function PlannerHome() {
  useClearedPlan()
  useSessionHandoff()
  const openTrip = useOpenTrip()
  const planned = usePlan(hasPlan)
  const attempt = useLatestPlanAttempt()
  return (
    <div className="space-y-5 p-5">
      {!planned && attempt.status !== 'pending' && (
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
      <TripForm onPlanned={openTrip} />
      <ResultsArea onPlanned={openTrip} />
    </div>
  )
}

/** Empties the plan on screen when the page opens, so the map and timeline start clear. */
function useClearedPlan() {
  const queryClient = useQueryClient()
  useEffect(() => {
    void queryClient.resetQueries({ queryKey: planKeys.current(), exact: true })
    useUiStore.getState().showPlan(null)
  }, [queryClient])
}

/** Arriving from a session that just ended (sessionHandoff.ts): refresh it here, once. */
function useSessionHandoff() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const ended = sessionEndedIn(location.state)
  useEffect(() => {
    if (!ended) return
    void finishSessionEnd(queryClient, ended)
    // Clear the note, so going back and forth doesn't repeat it.
    void navigate(location.pathname, { replace: true, state: null })
  }, [ended, queryClient, navigate, location.pathname])
}

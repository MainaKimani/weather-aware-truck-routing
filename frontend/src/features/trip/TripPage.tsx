/**
 * `/trips/:id`: a saved trip, exactly as it was planned (RFC §7.4). The
 * routes, checkpoints and heatmap are the stored ones, not today's weather,
 * and a banner says so. Opening it puts the trip on screen for the map and
 * timeline; planning from here opens the new trip's page.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useParams } from 'react-router'

import { planKeys, usePlan } from '../../api/plans'
import type { Plan, Trip } from '../../api/schema'
import { useTrip } from '../../api/trips'
import { formatDateTime } from '../../lib/format'
import { browserZone } from '../../lib/time'
import { useUiStore } from '../../state/ui'
import { PlanFailure } from '../plan/PlanFailure'
import { ResultsArea } from '../plan/ResultsArea'
import { RouteSkeletons } from '../plan/RouteSkeletons'
import { useOpenTrip } from '../planner/useOpenTrip'
import { NotFound } from '../shell/NotFound'
import { TripForm } from '../trip-form/TripForm'

export function TripPage() {
  const { tripId = '' } = useParams()
  const trip = useTrip(tripId)
  const openTrip = useOpenTrip()
  useTripOnScreen(trip.data)
  // A plan just made is on screen already; it shows while its saved copy loads.
  const onScreen = usePlan(selectInputs)
  const shown = usePlan(selectTripId) === tripId ? onScreen : undefined
  const inputs = trip.data?.inputs ?? shown

  if (trip.isError) {
    return (
      <div className="p-5">
        {trip.error.code === 'not_found' ? (
          <NotFound title="Trip not found">
            It may have been deleted, or it's private to whoever planned it.
          </NotFound>
        ) : (
          <PlanFailure
            error={trip.error}
            onRetry={() => void trip.refetch()}
            retrying={trip.isFetching}
          />
        )}
      </div>
    )
  }
  if (!inputs) {
    return (
      <div className="p-5">
        <RouteSkeletons />
      </div>
    )
  }
  return (
    <div className="space-y-5 p-5">
      {trip.data && <PlannedBanner trip={trip.data} />}
      <TripForm key={tripId} inputs={inputs} onPlanned={openTrip} />
      <ResultsArea onPlanned={openTrip} />
    </div>
  )
}

const selectInputs = (plan: Plan) => plan.inputs
const selectTripId = (plan: Plan) => plan.trip_id

/**
 * Puts the trip on screen, starting on its recommended route. A plan just
 * made is already there: the saved trip is the same response, so the screen
 * and the user's selection are left as they are.
 */
function useTripOnScreen(trip: Trip | undefined) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!trip) return
    if (queryClient.getQueryData<Plan>(planKeys.current())?.trip_id === trip.trip_id) return
    queryClient.setQueryData<Plan>(planKeys.current(), trip)
    useUiStore.getState().showPlan(trip.recommended_route_id ?? trip.routes[0]?.id ?? null)
  }, [queryClient, trip])
}

function PlannedBanner({ trip }: { trip: Trip }) {
  const zone = trip.inputs.origin.tz ?? browserZone()
  return (
    <p className="rounded-card border border-line bg-surface-raised px-3 py-2 text-xs text-muted">
      {trip.name && <span className="block text-sm font-semibold text-ink">{trip.name}</span>}
      Planned {formatDateTime(trip.created_at, zone)}, with the forecast as of then.
    </p>
  )
}

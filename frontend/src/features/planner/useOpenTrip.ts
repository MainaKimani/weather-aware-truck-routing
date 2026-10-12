import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import type { Plan } from '../../api/schema'

/** Goes to a new plan's trip page, so its address is the trip's own link. */
export function useOpenTrip() {
  const navigate = useNavigate()
  return useCallback(
    (plan: Plan) => {
      void navigate(`/trips/${plan.trip_id}`)
    },
    [navigate],
  )
}

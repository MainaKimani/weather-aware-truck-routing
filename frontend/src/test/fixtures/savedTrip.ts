import type { Plan, Trip } from '../../api/schema'
import { demoPlan } from './demoPlan'

/** A plan as GET /api/v1/trips/{id} returns it: the plan plus what the owner set. */
export function savedTrip(plan: Plan = demoPlan, meta: Partial<Trip> = {}): Trip {
  return {
    ...plan,
    name: '',
    saved: false,
    shared: false,
    created_at: plan.generated_at,
    is_owner: true,
    replanned_from: null,
    ...meta,
  }
}

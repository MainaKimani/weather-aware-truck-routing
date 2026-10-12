/**
 * Planning a trip. The plan is a mutation (it creates a trip on the server),
 * and its result is written into the query cache. Components read it with
 * `usePlan(select)`, subscribing only to the part they show, so a change to
 * one part of the plan or to UI state elsewhere doesn't re-render them.
 */
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'
import { useCallback } from 'react'

import { useUiStore } from '../state/ui'
import { api, unwrap } from './client'
import type { ApiError } from './errors'
import type { Plan, PlanRequest } from './schema'

export const planKeys = {
  all: ['plan'] as const,
  /** The plan on screen. Becomes `['trips', id]` once plans are saved as trips. */
  current: () => [...planKeys.all, 'current'] as const,
}

interface PlanVariables {
  request: PlanRequest
  /** One per submission, so an automatic retry can't create a second trip (RFC §18.3). */
  idempotencyKey: string
}

export function planTrip({ request, idempotencyKey }: PlanVariables, signal?: AbortSignal) {
  return unwrap(
    api.POST('/api/v1/plans', {
      body: request,
      headers: { 'Idempotency-Key': idempotencyKey },
      signal,
    }),
  )
}

export interface PlanOptions {
  onSuccess?: (plan: Plan) => void
}

export type PlanMutation = Omit<UseMutationResult<Plan, ApiError, PlanVariables>, 'mutate'> & {
  plan: (request: PlanRequest, options?: PlanOptions) => void
}

export function usePlanTrip(): PlanMutation {
  const queryClient = useQueryClient()
  const showPlan = useUiStore((s) => s.showPlan)
  const { mutate, ...mutation } = useMutation<Plan, ApiError, PlanVariables>({
    mutationKey: [...planKeys.all, 'create'],
    mutationFn: (variables) => planTrip(variables),
    onSuccess: (plan) => {
      queryClient.setQueryData(planKeys.current(), plan)
      showPlan(plan.recommended_route_id ?? plan.routes[0]?.id ?? null)
    },
  })
  const plan = useCallback(
    (request: PlanRequest, options?: PlanOptions) => {
      mutate({ request, idempotencyKey: crypto.randomUUID() }, options)
    },
    [mutate],
  )
  return { ...mutation, plan }
}

/**
 * A slice of the plan on screen, or undefined before the first plan. Pass a
 * stable `select` (module-level or useCallback) to keep re-renders to
 * changes in that slice.
 */
export function usePlan<T = Plan>(select?: (plan: Plan) => T): T | undefined {
  const { data } = useQuery<Plan, ApiError, T>({
    queryKey: planKeys.current(),
    queryFn: skipToken, // only ever written by usePlanTrip
    staleTime: Infinity,
    gcTime: Infinity,
    select,
  })
  return data
}

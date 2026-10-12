/**
 * Who the caller is: a signed-in user, a guest who has planned on this
 * device, or neither (RFC §7.5). The header, the guards and the trip pages
 * all read this one query.
 *
 * Asking also sets Django's CSRF cookie, which every later sign-up, login
 * and plan sends back, so the app asks as soon as it starts.
 */
import { useQuery } from '@tanstack/react-query'

import { api, unwrap } from './client'
import type { Me } from './schema'

export const meKeys = {
  all: ['me'] as const,
}

export function fetchMe(signal?: AbortSignal): Promise<Me> {
  return unwrap(api.GET('/api/v1/me', { signal }))
}

/**
 * Fresh until something changes it: signing in or out and planning invalidate
 * it, so it isn't fetched again each time another component asks.
 */
const meQuery = {
  queryKey: meKeys.all,
  queryFn: ({ signal }: { signal: AbortSignal }) => fetchMe(signal),
  staleTime: Infinity,
}

export function useMe() {
  return useQuery(meQuery)
}

const selectUser = (me: Me) => me.user

/** The signed-in user, null for a guest or visitor, undefined until known. */
export function useCurrentUser() {
  return useQuery({ ...meQuery, select: selectUser }).data
}

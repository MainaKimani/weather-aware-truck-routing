/**
 * Who the caller is: a signed-in user, a guest who has planned on this
 * device, or neither (RFC §7.5). The header, the guards and the trip pages
 * all read this one query.
 *
 * Asking also sets Django's CSRF cookie, which every later sign-up, login
 * and plan sends back, so the app asks as soon as it starts.
 */
import { useMutation, useQuery } from '@tanstack/react-query'

import { api, readCookie, unwrap } from './client'
import { fromResponse, networkError, type ApiError } from './errors'
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

/**
 * Delete the account and everything in it (RFC §7.5); needs the password.
 *
 * A plain fetch: the body of a DELETE has no meaning in OpenAPI 3.0, so the
 * generated client has no type for it, though the API reads it.
 */
export async function deleteAccount(password: string): Promise<null> {
  let response: Response
  try {
    response = await globalThis.fetch('/api/v1/me', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': readCookie('csrftoken') ?? '',
      },
      body: JSON.stringify({ password }),
    })
  } catch (cause) {
    throw networkError(cause)
  }
  if (response.ok) return null
  throw fromResponse(response, await response.json().catch(() => null))
}

export function useDeleteAccount() {
  return useMutation<null, ApiError, string>({ mutationFn: deleteAccount })
}

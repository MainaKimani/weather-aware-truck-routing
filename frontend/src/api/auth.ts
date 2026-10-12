/**
 * Sign-up, login and logout through django-allauth's headless API for the
 * browser (RFC §7.5), mounted at /api/auth/. It answers in its own shape,
 * `{status, data, meta}` or `{status, errors: [{code, message, param}]}`,
 * not the rest of the API's, so it has this small client of its own.
 *
 * After any of them the session has changed, so who the caller is and which
 * trips they can see are fetched again: the header and lists update with no
 * page reload.
 */
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { readCookie } from './client'
import { meKeys } from './me'

const AUTH = '/api/auth/browser/v1/auth'

export interface AuthIssue {
  code: string
  message: string
  /** The field it belongs to (`email`, `password`), if any. */
  param?: string
}

/** A refused sign-up or login, with allauth's reasons. */
export class AuthError extends Error {
  readonly issues: readonly AuthIssue[]
  readonly status: number

  constructor(status: number, issues: readonly AuthIssue[]) {
    super(issues.map((i) => i.message).join(' ') || 'Something went wrong. Try again.')
    this.name = 'AuthError'
    this.status = status
    this.issues = issues
  }

  /** Messages by field; those without one under `form`. */
  byField(): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const issue of this.issues) (out[issue.param ?? 'form'] ??= []).push(issue.message)
    return out
  }

  has(code: string): boolean {
    return this.issues.some((i) => i.code === code)
  }
}

export interface Credentials {
  email: string
  password: string
}

async function call(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<null> {
  let response: Response
  try {
    response = await globalThis.fetch(`${AUTH}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': readCookie('csrftoken') ?? '',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new AuthError(0, [
      { code: 'network_error', message: "Can't reach the server. Check your connection." },
    ])
  }
  // Signing out answers 401 "not authenticated", which is the point.
  if (response.ok || (method === 'DELETE' && response.status === 401)) return null
  throw new AuthError(response.status, await issuesFrom(response))
}

async function issuesFrom(response: Response): Promise<AuthIssue[]> {
  const body: unknown = await response.json().catch(() => null)
  if (isRecord(body) && Array.isArray(body.errors)) return body.errors as AuthIssue[]
  // The API's own shape: a refused CSRF check, say.
  if (isRecord(body) && isRecord(body.error)) {
    const { code, message } = body.error as { code: string; message: string }
    return [{ code, message }]
  }
  if (response.status === 429)
    return [{ code: 'rate_limited', message: 'Too many attempts. Try again in a minute.' }]
  return [{ code: 'server_error', message: 'Something went wrong. Try again.' }]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export const signUp = (credentials: Credentials) => call('POST', '/signup', credentials)
export const logIn = (credentials: Credentials) => call('POST', '/login', credentials)
export const logOut = () => call('DELETE', '/session')

/** After the session changes: who the caller is, and their trips (not heatmaps, which never change). */
export async function refreshSession(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: meKeys.all }),
    queryClient.invalidateQueries({
      queryKey: ['trips'],
      predicate: (query) => query.queryKey[2] !== 'heatmap',
    }),
  ])
}

function useSessionMutation(fn: (credentials: Credentials) => Promise<null>) {
  const queryClient = useQueryClient()
  return useMutation<null, AuthError, Credentials>({
    mutationFn: fn,
    onSuccess: () => refreshSession(queryClient),
  })
}

export const useSignUp = () => useSessionMutation(signUp)
export const useLogIn = () => useSessionMutation(logIn)

export function useLogOut() {
  const queryClient = useQueryClient()
  return useMutation<null, AuthError>({
    mutationFn: logOut,
    onSuccess: () => refreshSession(queryClient),
  })
}

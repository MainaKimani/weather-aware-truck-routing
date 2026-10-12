/**
 * The typed API client. Paths, request bodies and responses come from
 * schema.ts, which is generated from the backend's OpenAPI schema, so a
 * contract change shows up as a type error here rather than in the browser.
 *
 * The API is same-origin (the frontend host proxies /api), so session and
 * CSRF cookies are first-party and no CORS is involved (RFC §3.2).
 */
import createClient, { type Middleware } from 'openapi-fetch'

import { ApiError, fromResponse, networkError } from './errors'
import type { paths } from './schema'

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}

/** Django checks X-CSRFToken against the csrftoken cookie on unsafe methods (RFC §7.5). */
const csrf: Middleware = {
  onRequest({ request }) {
    if (!UNSAFE.has(request.method)) return undefined
    const token = readCookie('csrftoken')
    if (token) request.headers.set('X-CSRFToken', token)
    return request
  },
}

// The page's own origin: same as a relative URL in the browser, and lets
// Node's fetch (tests) resolve the path.
export function createApi(baseUrl = window.location.origin) {
  const client = createClient<paths>({
    baseUrl,
    credentials: 'same-origin',
    // Look fetch up per request rather than capturing it now, so anything that
    // wraps fetch later (test servers, monitoring) still sees API calls.
    fetch: (request) => globalThis.fetch(request),
  })
  client.use(csrf)
  return client
}

export const api = createApi()

/**
 * By name, not `instanceof DOMException`: the abort can come from another
 * realm's DOMException (the fetch implementation's), which instanceof misses.
 */
function isAbort(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError'
  )
}

interface FetchResult<T> {
  data?: T
  error?: unknown
  response: Response
}

/**
 * The response data, or an ApiError. Network failures (fetch rejecting)
 * become `network_error`; an abort is rethrown untouched so cancelled
 * queries stay cancelled.
 */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>
  try {
    result = await request
  } catch (cause) {
    if (isAbort(cause)) throw cause
    throw networkError(cause)
  }
  const { data, error, response } = result
  if (!response.ok) throw fromResponse(response, error)
  if (data === undefined) {
    throw new ApiError('server_error', 'The server returned an empty response.', response.status)
  }
  return data
}

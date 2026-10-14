/**
 * Every failed request becomes an ApiError with the backend's error code
 * (RFC §7.2: `{"error": {code, message, fields?}}`), so callers branch on
 * `code`, never on status numbers or message text.
 */

/** Codes the UI handles specially; any other code still arrives as a string. */
export type KnownErrorCode =
  | 'invalid_input'
  | 'no_route'
  | 'routing_unavailable'
  | 'weather_unavailable'
  | 'weather_busy'
  | 'geocoding_unavailable'
  | 'quota_reached'
  | 'rate_limited'
  | 'not_found'
  | 'network_error'
  | 'server_error'

export type ErrorCode = KnownErrorCode | (string & {})

export class ApiError extends Error {
  override readonly name = 'ApiError'
  readonly code: ErrorCode
  /** HTTP status; 0 when the request never got a response. */
  readonly status: number
  /** Validation messages by field, nested fields dotted ("hos.drive_left_h"). */
  readonly fields: Readonly<Record<string, readonly string[]>>
  /** The backend's X-Request-ID, for matching a report to the logs. */
  readonly requestId: string | null
  /** Seconds to wait before retrying, from Retry-After. */
  readonly retryAfterS: number | null

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    fields: Readonly<Record<string, readonly string[]>> = {},
    requestId: string | null = null,
    retryAfterS: number | null = null,
  ) {
    super(message)
    this.code = code
    this.status = status
    this.fields = fields
    this.requestId = requestId
    this.retryAfterS = retryAfterS
  }

  /**
   * Worth retrying automatically: the request may succeed unchanged. A spent
   * monthly allowance (quota_reached, a 503) won't come back until next month,
   * and a busy weather service (weather_busy, a 503) says when to retry in
   * Retry-After, so neither is retried straight away.
   */
  get transient(): boolean {
    if (this.code === 'quota_reached' || this.code === 'weather_busy') return false
    return this.code === 'network_error' || this.status === 502 || this.status === 503
  }
}

interface ErrorBody {
  error: { code: string; message: string; fields?: Record<string, string[]> }
}

function isErrorBody(body: unknown): body is ErrorBody {
  if (typeof body !== 'object' || body === null || !('error' in body)) return false
  const error = body.error
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  )
}

/** An ApiError from a non-2xx response and its parsed body (if it was JSON). */
export function fromResponse(response: Response, body: unknown): ApiError {
  const requestId = response.headers.get('X-Request-ID')
  const retryAfter = Number(response.headers.get('Retry-After'))
  const retryAfterS = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
  if (isErrorBody(body)) {
    const { code, message, fields } = body.error
    return new ApiError(code, message, response.status, fields ?? {}, requestId, retryAfterS)
  }
  // A proxy or crash page rather than our API: keep the status, say so plainly.
  const code = response.status === 429 ? 'rate_limited' : 'server_error'
  return new ApiError(
    code,
    `The server returned an unexpected response (${String(response.status)}).`,
    response.status,
    {},
    requestId,
    retryAfterS,
  )
}

export function networkError(cause: unknown): ApiError {
  const error = new ApiError(
    'network_error',
    "Couldn't reach the server. Check your connection and try again.",
    0,
  )
  error.cause = cause
  return error
}

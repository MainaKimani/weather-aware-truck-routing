/**
 * What to tell the user for each way a plan can fail (RFC §11), naming the
 * service involved. Field errors (invalid_input) are shown on the form.
 */
import type { ApiError } from '../../api/errors'

export interface FailureCopy {
  title: string
  detail: string
}

export function failureCopy(error: ApiError): FailureCopy {
  switch (error.code) {
    case 'no_route':
      return {
        title: 'No truck route between these places',
        detail:
          'The routing service found no road a truck can take. Check the places, or try nearby cities.',
      }
    case 'routing_unavailable':
      return {
        title: 'Routing is unavailable',
        detail: "We couldn't reach the routing service (HERE). Try again in a moment.",
      }
    case 'quota_reached':
      return {
        title: 'Live routing is paused until next month',
        detail:
          "This month's allowance of routing requests (HERE) is used up. Routing comes back on the 1st (UTC). Saved trips still open.",
      }
    case 'weather_unavailable':
      return {
        title: 'Weather data is unavailable',
        detail:
          "We couldn't get forecasts from Open-Meteo and have no recent copy, so no risk is shown rather than guessed. Try again in a moment.",
      }
    case 'rate_limited':
      return {
        title: 'Too many requests',
        detail: 'Planning is limited to a few trips a minute.',
      }
    case 'network_error':
      return {
        title: "Can't reach the server",
        detail: 'Check your connection and try again.',
      }
    default:
      return {
        title: 'Something went wrong on our side',
        detail: 'Try again in a moment.',
      }
  }
}

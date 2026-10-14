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
    case 'weather_busy':
      return {
        title: 'The weather service is busy',
        detail: busyDetail(error.retryAfterS),
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

/** Open-Meteo's free tier limits forecasts a minute, an hour and a day. */
function busyDetail(retryAfterS: number | null): string {
  const lead = 'Our free weather service (Open-Meteo) allows only so many forecasts at a time.'
  if (retryAfterS === null || retryAfterS <= 120) {
    return `${lead} Try again in a minute; forecasts fetched so far are kept.`
  }
  const minutes = Math.ceil(retryAfterS / 60)
  return `${lead} Its allowance is used up for now; try again in about ${String(minutes)} minutes.`
}

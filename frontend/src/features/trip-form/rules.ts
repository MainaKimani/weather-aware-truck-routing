/**
 * The trip form's rules and messages. They mirror the API's validation
 * (backend/planner/api/serializers.py) rule for rule and word for word, so
 * a mistake shows the same text whether the browser or the server catches
 * it. Change both together.
 */
export const MAX_LOAD_LB = 80_000
export const DEPARTURE_GRACE_MS = 15 * 60_000
export const DEPARTURE_MAX_AHEAD_MS = 7 * 24 * 3600_000
export const LOW_CONFIDENCE_AHEAD_MS = 48 * 3600_000
export const MIN_TRIP_MI = 1

export const MESSAGES = {
  required: 'This field is required.',
  // Client-only: text typed but no suggestion picked, so there are no coordinates yet.
  pickPlace: 'Choose a place from the suggestions.',
  samePlace: 'Destination must be more than a mile from the origin.',
  departurePast: "Departure can't be in the past.",
  departureTooFar: 'Departure must be within the next 7 days.',
  integer: 'A valid integer is required.',
  min: (n: number) => `Ensure this value is greater than or equal to ${String(n)}.`,
  max: (n: number) => `Ensure this value is less than or equal to ${String(n)}.`,
  choice: (value: unknown) => `"${String(value)}" is not a valid choice.`,
} as const

/** How Hours of Service stops are named, wherever they're shown (route cards, map). */
import type { HosStopKindEnum, HosStopReasonEnum } from '../api/schema'

export const STOP_KIND_LABEL: Readonly<Record<HosStopKindEnum, string>> = {
  break: 'Break',
  rest: 'Rest',
  restart: 'Restart',
}

/** What made the stop necessary. */
export const STOP_REASON_LABEL: Readonly<Record<HosStopReasonEnum, string>> = {
  break: '8 h driving',
  drive_limit: '11 h driving limit',
  window: '14 h shift window',
  cycle: 'weekly cycle',
}

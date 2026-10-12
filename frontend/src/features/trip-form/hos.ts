/**
 * Hours of Service inputs (PRD §7.3.1): the four clocks a driver's ELD
 * shows, entered as hh:mm. Limits and messages mirror the API's HOS
 * serializer.
 */
import type { CycleEnum, HosRequest } from '../../api/schema'
import { MESSAGES } from './rules'

export type Cycle = CycleEnum
export type ClockField = 'driveLeft' | 'windowLeft' | 'untilBreak' | 'cycleLeft'

export interface HosValues {
  enabled: boolean
  cycle: Cycle
  driveLeft: string
  windowLeft: string
  untilBreak: string
  cycleLeft: string
}

export const CYCLE_HOURS: Record<Cycle, number> = { '70h_8d': 70, '60h_7d': 60 }
export const CYCLE_LABELS: Record<Cycle, string> = {
  '70h_8d': '70 h / 8 days',
  '60h_7d': '60 h / 7 days',
}

export const CLOCKS: readonly {
  field: ClockField
  api: keyof HosRequest
  label: string
  maxH: (c: Cycle) => number
}[] = [
  { field: 'driveLeft', api: 'drive_left_h', label: 'Drive time available', maxH: () => 11 },
  { field: 'windowLeft', api: 'window_left_h', label: 'Shift time available', maxH: () => 14 },
  { field: 'untilBreak', api: 'until_break_h', label: 'Time until break', maxH: () => 8 },
  {
    field: 'cycleLeft',
    api: 'cycle_left_h',
    label: 'Cycle time available',
    maxH: (c) => CYCLE_HOURS[c],
  },
]

export const HOS_MESSAGES = {
  clock: 'Enter hours and minutes, like 10:30.',
  driveOverLimits: "Can't be more than the shift window or cycle time left.",
  cycleCapped: (hours: number) =>
    `Cycle time capped at ${String(hours)}:00, the most a ${String(hours)} h cycle allows.`,
} as const

/** A fully rested driver: every clock full (PRD §7.3.1 defaults). */
export function restedHos(cycle: Cycle = '70h_8d'): HosValues {
  return {
    enabled: false,
    cycle,
    driveLeft: '11:00',
    windowLeft: '14:00',
    untilBreak: '08:00',
    cycleLeft: `${String(CYCLE_HOURS[cycle])}:00`,
  }
}

/** Minutes from "h:mm" or "hh:mm" (hours may exceed 24 for the cycle), or null. */
export function parseClock(text: string): number | null {
  const m = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(text)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function formatClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Hours with two decimals, as the API takes them ("10.50"). */
export function clockToHours(minutes: number): string {
  return (minutes / 60).toFixed(2)
}

/** Field errors for HOS values, in the API's words; empty when valid or HOS is off. */
export function hosErrors(hos: HosValues): Partial<Record<ClockField, string>> {
  if (!hos.enabled) return {}
  const errors: Partial<Record<ClockField, string>> = {}
  const minutes: Partial<Record<ClockField, number>> = {}
  for (const { field, maxH } of CLOCKS) {
    const text = hos[field]
    if (!text.trim()) {
      errors[field] = MESSAGES.required
      continue
    }
    const value = parseClock(text)
    if (value === null) errors[field] = HOS_MESSAGES.clock
    else if (value > maxH(hos.cycle) * 60) errors[field] = MESSAGES.max(maxH(hos.cycle))
    else minutes[field] = value
  }
  const { driveLeft, windowLeft, cycleLeft } = minutes
  if (
    driveLeft !== undefined &&
    windowLeft !== undefined &&
    cycleLeft !== undefined &&
    driveLeft > Math.min(windowLeft, cycleLeft)
  ) {
    errors.driveLeft = HOS_MESSAGES.driveOverLimits
  }
  return errors
}

/** The API's HOS block: just `{enabled: false}` when the toggle is off. */
export function toHosRequest(hos: HosValues): HosRequest {
  if (!hos.enabled) return { enabled: false }
  const hours = (text: string) => {
    const m = parseClock(text)
    if (m === null) throw new Error('HOS values are not valid')
    return clockToHours(m)
  }
  return {
    enabled: true,
    cycle: hos.cycle,
    drive_left_h: hours(hos.driveLeft),
    window_left_h: hours(hos.windowLeft),
    until_break_h: hours(hos.untilBreak),
    cycle_left_h: hours(hos.cycleLeft),
  }
}

/** The form field for an API HOS field ("hos.drive_left_h" → "driveLeft"). */
export function hosFieldFor(apiField: string): ClockField | 'cycle' | null {
  const name = apiField.split('.')[1]
  if (name === 'cycle') return 'cycle'
  return CLOCKS.find((c) => c.api === name)?.field ?? null
}

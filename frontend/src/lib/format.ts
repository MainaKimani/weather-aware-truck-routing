/**
 * Display formatting: one place for how numbers, durations and times read,
 * so a card, a table row and a popup always say the same thing.
 */
import { zoneAbbreviation } from './time'

const MIN = 60
const HOUR = 3600

/** "742 mi", "1,204 mi". */
export function formatMiles(mi: number): string {
  return `${Math.round(mi).toLocaleString('en-US')} mi`
}

/** Drive or trip time: "45 min", "11 h 44 min", "23 h 07 min". */
export function formatDuration(seconds: number): string {
  const totalMin = Math.round(seconds / MIN)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${String(m)} min`
  return `${String(h)} h ${String(m).padStart(2, '0')} min`
}

/** A stop's length, in its natural unit: "30 min", "10 h", "34 h", "1 h 30 min". */
export function formatStopLength(seconds: number): string {
  if (seconds % HOUR === 0) return `${String(seconds / HOUR)} h`
  if (seconds < HOUR) return `${String(Math.round(seconds / MIN))} min`
  return formatDuration(seconds)
}

/** "Mon 07:04 CDT": weekday, 24-hour time and zone, on the clock of `timeZone`. */
export function formatClockTime(iso: string, timeZone: string): string {
  const date = new Date(iso)
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return `${time} ${zoneAbbreviation(date, timeZone)}`
}

/** "0.25 / 4.0", or "No data" when every checkpoint is Unknown. */
export function formatAvgRisk(avg: number | null): string {
  return avg === null ? 'No data' : `${avg.toFixed(2)} / 4.0`
}

/** How long ago, coarsely: "just now", "12 min ago", "2 h ago". */
export function formatAge(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${String(minutes)} min ago`
  return `${String(Math.round(minutes / 60))} h ago`
}

/** Weather values with units, or "No data" (never blank, never zero). */
export function formatValue(value: number | null | undefined, unit: string, digits = 0): string {
  return value === null || value === undefined ? 'No data' : `${value.toFixed(digits)} ${unit}`
}

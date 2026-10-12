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

/**
 * "Mon 07:04 CDT": weekday, 24-hour time and zone, on the clock of `timeZone`.
 * Without the zone ("Mon 07:04") where a heading already names it.
 */
export function formatClockTime(iso: string, timeZone: string, withZone = true): string {
  const date = new Date(iso)
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
  return withZone ? `${time} ${zoneAbbreviation(date, timeZone)}` : time
}

/** "Mon 12 Oct, 07:04 CDT": with the date, for times that may be days away. */
export function formatDateTime(iso: string, timeZone: string): string {
  const date = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
  const day = `${part('weekday') ?? ''} ${part('day') ?? ''} ${part('month') ?? ''}`
  return `${day}, ${part('hour') ?? ''}:${part('minute') ?? ''} ${zoneAbbreviation(date, timeZone)}`
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

/** A weather value, or "No data" (never blank, never zero). */
export function formatNumber(value: number | null | undefined, digits = 0): string {
  return value === null || value === undefined ? 'No data' : value.toFixed(digits)
}

/** A weather value with its unit, or "No data". */
export function formatValue(value: number | null | undefined, unit: string, digits = 0): string {
  const n = formatNumber(value, digits)
  return n === 'No data' ? n : `${n} ${unit}`
}

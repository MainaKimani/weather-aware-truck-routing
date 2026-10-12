/**
 * What time each slider hour is. Hour 0 is the forecast hour in progress,
 * whose record is stamped at the end of that hour: the heatmap's
 * `start_hour` (RFC §7.3). Until the heatmap arrives, the next whole hour
 * after the plan was made stands in for it; it is the same hour unless the
 * plan was made right at the turn of an hour.
 */
import { formatClockTime } from '../../lib/format'

const HOUR_MS = 3600_000

/** The instant slider hour 0 shows, or null before there is a plan. */
export function timelineStart(
  heatmapStart: string | undefined,
  planGeneratedAt: string | undefined,
): string | null {
  if (heatmapStart) return heatmapStart
  if (!planGeneratedAt) return null
  const next = Math.floor(new Date(planGeneratedAt).getTime() / HOUR_MS) * HOUR_MS + HOUR_MS
  return new Date(next).toISOString()
}

export function hourInstant(start: string, hour: number): string {
  return new Date(new Date(start).getTime() + hour * HOUR_MS).toISOString()
}

/** "+14 h · Sat 20:00 CDT", or "+14 h" before there is a plan. */
export function hourLabel(start: string | null, hour: number, timeZone: string): string {
  const offset = `+${String(hour)} h`
  if (!start) return offset
  return `${offset} · ${formatClockTime(hourInstant(start, hour), timeZone)}`
}

/** What a screen reader says: "+14 hours, Saturday 20:00", or "+1 hour from now". */
export function hourValueText(start: string | null, hour: number, timeZone: string): string {
  const offset = `+${String(hour)} ${hour === 1 ? 'hour' : 'hours'}`
  if (!start) return `${offset} from now`
  const clock = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(hourInstant(start, hour)))
  return `${offset}, ${clock}`
}

/** The last instant the timeline shows, when it is before `departure`; otherwise null. */
export function windowEndBeforeDeparture(
  start: string | null,
  lastHour: number,
  departure: string | undefined,
): string | null {
  if (!start || !departure) return null
  const end = hourInstant(start, lastHour)
  return new Date(end).getTime() < new Date(departure).getTime() ? end : null
}

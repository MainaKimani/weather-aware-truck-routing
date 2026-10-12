/**
 * Wall-clock times in a named time zone, with only the Intl API.
 *
 * The departure is entered in the origin's zone ("06:00 in Dallas"), sent
 * as UTC, and every time shown afterwards is formatted back into a zone.
 * `<input type="datetime-local">` speaks "YYYY-MM-DDTHH:mm" with no zone,
 * so these helpers convert between that and UTC for any IANA zone.
 */

const MINUTE = 60_000

export function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsFormatters.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timeZone, f)
  }
  return f
}

/** The wall clock in `timeZone` at instant `ms`, as if it were UTC (ms). */
function wallClockMs(ms: number, timeZone: string): number {
  const p: Record<string, number> = {}
  for (const { type, value } of partsFormatter(timeZone).formatToParts(ms)) {
    if (type !== 'literal') p[type] = Number(value)
  }
  return Date.UTC(p.year ?? 0, (p.month ?? 1) - 1, p.day, p.hour, p.minute, p.second)
}

/** Minutes the zone is ahead of UTC at `ms` (Chicago in summer: -300). */
export function offsetMinutes(ms: number, timeZone: string): number {
  return Math.round((wallClockMs(ms, timeZone) - Math.floor(ms / 1000) * 1000) / MINUTE)
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/**
 * The instant at which the clock in `timeZone` reads `local`. In the spring
 * gap (a time that doesn't exist), the clock is read forward past the gap;
 * in the autumn overlap (a time that happens twice), the first is used.
 */
export function zonedToUtc(local: string, timeZone: string): Date {
  const m = LOCAL.exec(local)
  if (!m) throw new RangeError(`Not a local date-time: ${local}`)
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number]
  const asUtc = Date.UTC(y, mo - 1, d, h, mi)
  // Try every offset in force within a day either side (zones are at most
  // 14 h from UTC, so this sees both sides of any DST change); the earliest
  // that reads back as `local` wins.
  const candidates = [asUtc - 86_400_000, asUtc, asUtc + 86_400_000]
    .map((probe) => asUtc - offsetMinutes(probe, timeZone) * MINUTE)
    .sort((a, b) => a - b)
  const exact = candidates.find((t) => wallClockMs(t, timeZone) === asUtc)
  if (exact !== undefined) return new Date(exact)
  // In a gap: shift by the gap, so 02:30 on spring-forward day becomes 03:30.
  const before = offsetMinutes(asUtc - 12 * 3600_000, timeZone)
  return new Date(asUtc - before * MINUTE)
}

/** "YYYY-MM-DDTHH:mm" for `date` on the clock in `timeZone`. */
export function utcToZonedInput(date: Date, timeZone: string): string {
  return new Date(wallClockMs(date.getTime(), timeZone)).toISOString().slice(0, 16)
}

/** Short zone name at that moment, e.g. "CDT", or "GMT-5" where none exists. */
export function zoneAbbreviation(date: Date, timeZone: string): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? timeZone
}

/** The next whole hour from `now`, as the clock in `timeZone` shows it. */
export function nextWholeHourInput(now: Date, timeZone: string): string {
  const next = new Date(Math.floor(now.getTime() / 3600_000) * 3600_000 + 3600_000)
  return utcToZonedInput(next, timeZone)
}

export function isValidZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

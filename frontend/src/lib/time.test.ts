import { describe, expect, it } from 'vitest'

import {
  isValidZone,
  nextWholeHourInput,
  offsetMinutes,
  utcToZonedInput,
  zoneAbbreviation,
  zonedToUtc,
} from './time'

const CHICAGO = 'America/Chicago'

describe('zonedToUtc', () => {
  it.each([
    ['2026-10-12T06:00', CHICAGO, '2026-10-12T11:00:00.000Z'], // CDT, UTC-5
    ['2026-12-12T06:00', CHICAGO, '2026-12-12T12:00:00.000Z'], // CST, UTC-6
    ['2026-10-12T06:00', 'America/Denver', '2026-10-12T12:00:00.000Z'],
    ['2026-10-12T06:00', 'America/Phoenix', '2026-10-12T13:00:00.000Z'], // no DST
    ['2026-10-12T06:00', 'Asia/Kolkata', '2026-10-12T00:30:00.000Z'], // half-hour zone
    ['2026-10-12T06:00', 'UTC', '2026-10-12T06:00:00.000Z'],
  ])('%s in %s is %s', (local, zone, utc) => {
    expect(zonedToUtc(local, zone).toISOString()).toBe(utc)
  })

  it('reads a time in the spring-forward gap past the gap', () => {
    // 2026-03-08: Chicago clocks jump from 02:00 to 03:00.
    expect(zonedToUtc('2026-03-08T02:30', CHICAGO).toISOString()).toBe('2026-03-08T08:30:00.000Z')
  })

  it('takes the first of a time that happens twice in the autumn', () => {
    // 2026-11-01: 01:30 happens in CDT, then again in CST.
    expect(zonedToUtc('2026-11-01T01:30', CHICAGO).toISOString()).toBe('2026-11-01T06:30:00.000Z')
  })

  it('round-trips with utcToZonedInput', () => {
    for (const local of ['2026-01-31T23:59', '2026-07-04T00:00', '2026-11-01T03:15']) {
      expect(utcToZonedInput(zonedToUtc(local, CHICAGO), CHICAGO)).toBe(local)
    }
  })

  it('rejects text that is not a local date-time', () => {
    expect(() => zonedToUtc('2026-10-12 06:00', CHICAGO)).toThrow(RangeError)
  })
})

describe('zone helpers', () => {
  it('reports offsets and abbreviations', () => {
    const summer = Date.UTC(2026, 6, 1, 12)
    expect(offsetMinutes(summer, CHICAGO)).toBe(-300)
    expect(zoneAbbreviation(new Date(summer), CHICAGO)).toBe('CDT')
    expect(zoneAbbreviation(new Date(summer), 'America/Denver')).toBe('MDT')
  })

  it('suggests the next whole hour on the zone clock', () => {
    const now = new Date('2026-10-12T10:20:00Z')
    expect(nextWholeHourInput(now, CHICAGO)).toBe('2026-10-12T06:00')
  })

  it('knows a real zone from a made-up one', () => {
    expect(isValidZone(CHICAGO)).toBe(true)
    expect(isValidZone('Mars/Olympus')).toBe(false)
  })
})

describe('every local minute of a DST year round-trips', () => {
  it.each([
    'America/Chicago',
    'America/Denver',
    'America/New_York',
    'Europe/London',
    'Australia/Lord_Howe',
  ])('%s', (zone) => {
    // Every 15 minutes through 2026: each instant maps to a local time that maps back to it,
    // except the repeated autumn hour, which maps to its first occurrence.
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 3600_000) {
      const local = utcToZonedInput(new Date(t), zone)
      const back = zonedToUtc(local, zone).getTime()
      expect(back === t || back < t).toBe(true)
      expect(utcToZonedInput(new Date(back), zone)).toBe(local)
    }
  })
})

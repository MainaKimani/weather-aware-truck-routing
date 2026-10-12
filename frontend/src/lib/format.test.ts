import { describe, expect, it } from 'vitest'

import {
  formatAge,
  formatAvgRisk,
  formatClockTime,
  formatDateTime,
  formatDuration,
  formatMiles,
  formatStopLength,
  formatValue,
} from './format'

describe('format', () => {
  it.each([
    [742.42, '742 mi'],
    [1204.6, '1,205 mi'],
  ])('miles %d → %s', (mi, text) => {
    expect(formatMiles(mi)).toBe(text)
  })

  it.each([
    [45 * 60, '45 min'],
    [42_252, '11 h 44 min'],
    [80_053 + 7, '22 h 14 min'],
    [3600, '1 h 00 min'],
  ])('duration %i s → %s', (s, text) => {
    expect(formatDuration(s)).toBe(text)
  })

  it.each([
    [1800, '30 min'],
    [36_000, '10 h'],
    [122_400, '34 h'],
    [5400, '1 h 30 min'],
  ])('stop length %i s → %s (never "600 min")', (s, text) => {
    expect(formatStopLength(s)).toBe(text)
  })

  it('formats clock times in the given zone with its abbreviation', () => {
    expect(formatClockTime('2026-10-12T12:04:00Z', 'America/Chicago')).toBe('Mon 07:04 CDT')
    expect(formatClockTime('2026-10-13T05:53:43Z', 'America/Denver')).toBe('Mon 23:53 MDT')
  })

  it('formats a date and time with the day, for times that may be days away', () => {
    expect(formatDateTime('2026-10-12T12:04:00Z', 'America/Chicago')).toBe('Mon 12 Oct, 07:04 CDT')
    expect(formatDateTime('2026-11-02T03:30:00Z', 'America/Denver')).toBe('Sun 1 Nov, 20:30 MST')
  })

  it('says No data rather than showing nothing or zero', () => {
    expect(formatAvgRisk(null)).toBe('No data')
    expect(formatAvgRisk(0.25)).toBe('0.25 / 4.0')
    expect(formatValue(null, 'mph')).toBe('No data')
    expect(formatValue(0, 'in/h', 2)).toBe('0.00 in/h')
  })

  it('describes forecast age coarsely', () => {
    const now = new Date('2026-10-12T12:00:00Z')
    expect(formatAge('2026-10-12T11:59:40Z', now)).toBe('just now')
    expect(formatAge('2026-10-12T11:48:00Z', now)).toBe('12 min ago')
    expect(formatAge('2026-10-12T10:00:00Z', now)).toBe('2 h ago')
  })
})

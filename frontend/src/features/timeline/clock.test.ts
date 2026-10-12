import { describe, expect, it } from 'vitest'

import { hourLabel, hourValueText, timelineStart, windowEndBeforeDeparture } from './clock'

const CHICAGO = 'America/Chicago'
// Saturday 10 October 2026, 06:00 in Chicago.
const SAT_0600_CDT = '2026-10-10T11:00:00Z'

describe('timeline start', () => {
  it("is the heatmap's first hour once it has arrived", () => {
    expect(timelineStart('2026-10-12T15:00:00Z', '2026-10-12T14:00:28Z')).toBe(
      '2026-10-12T15:00:00Z',
    )
  })

  it('is the next whole hour after the plan until then', () => {
    expect(timelineStart(undefined, '2026-10-12T08:25:05Z')).toBe('2026-10-12T09:00:00.000Z')
    expect(timelineStart(undefined, '2026-10-12T08:00:00Z')).toBe('2026-10-12T09:00:00.000Z')
  })

  it('is unknown before there is a plan', () => {
    expect(timelineStart(undefined, undefined)).toBeNull()
  })
})

describe('hour label', () => {
  it('gives the offset and the clock time on the origin clock', () => {
    expect(hourLabel(SAT_0600_CDT, 14, CHICAGO)).toBe('+14 h · Sat 20:00 CDT')
    expect(hourLabel(SAT_0600_CDT, 0, 'America/Denver')).toBe('+0 h · Sat 05:00 MDT')
  })

  it('crosses the end of daylight saving time on the clock', () => {
    // 1 November 2026: Chicago goes back from CDT to CST at 02:00.
    expect(hourLabel('2026-11-01T05:00:00Z', 2, CHICAGO)).toBe('+2 h · Sun 01:00 CST')
  })

  it('is the offset alone before there is a plan', () => {
    expect(hourLabel(null, 6, CHICAGO)).toBe('+6 h')
  })
})

describe('hour value text', () => {
  it('reads as words for a screen reader', () => {
    expect(hourValueText(SAT_0600_CDT, 14, CHICAGO)).toBe('+14 hours, Saturday 20:00')
    expect(hourValueText(SAT_0600_CDT, 1, CHICAGO)).toBe('+1 hour, Saturday 07:00')
  })

  it('counts from now before there is a plan', () => {
    expect(hourValueText(null, 3, CHICAGO)).toBe('+3 hours from now')
  })
})

describe('window ending before departure', () => {
  it("is the timeline's last hour when the trip leaves after it", () => {
    expect(windowEndBeforeDeparture(SAT_0600_CDT, 48, '2026-10-13T12:00:00Z')).toBe(
      '2026-10-12T11:00:00.000Z',
    )
  })

  it('is null when the trip leaves within the window', () => {
    expect(windowEndBeforeDeparture(SAT_0600_CDT, 48, '2026-10-12T11:00:00Z')).toBeNull()
    expect(windowEndBeforeDeparture(SAT_0600_CDT, 48, '2026-10-10T12:00:00Z')).toBeNull()
    expect(windowEndBeforeDeparture(null, 48, '2026-10-13T12:00:00Z')).toBeNull()
  })
})

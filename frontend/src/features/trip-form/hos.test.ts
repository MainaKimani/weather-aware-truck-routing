import { describe, expect, it } from 'vitest'

import {
  HOS_MESSAGES,
  clockToHours,
  formatClock,
  hosErrors,
  hosFieldFor,
  parseClock,
  restedHos,
  toHosRequest,
  type HosValues,
} from './hos'

const on = (overrides: Partial<HosValues> = {}): HosValues => ({
  ...restedHos(),
  enabled: true,
  ...overrides,
})

describe('HOS clocks', () => {
  it.each([
    ['11:00', 660],
    ['8:05', 485],
    ['52:30', 3150],
    ['0:00', 0],
  ])('parses %s as %i minutes', (text, minutes) => {
    expect(parseClock(text)).toBe(minutes)
    expect(parseClock(formatClock(minutes))).toBe(minutes)
  })

  it.each(['', '11', '11:60', '-1:00', '9h', '1:5', '123:00'])('rejects %j', (text) => {
    expect(parseClock(text)).toBeNull()
  })

  it('sends hours with two decimals, as the API takes them', () => {
    expect(clockToHours(620)).toBe('10.33')
    expect(clockToHours(630)).toBe('10.50')
  })
})

describe('HOS rules (mirroring the API)', () => {
  it('a rested driver is valid, and nothing is checked with HOS off', () => {
    expect(hosErrors(on())).toEqual({})
    expect(hosErrors({ ...restedHos(), driveLeft: 'nonsense' })).toEqual({})
  })

  it.each([
    [{ driveLeft: '11:01' }, 'driveLeft', 'Ensure this value is less than or equal to 11.'],
    [{ windowLeft: '14:30' }, 'windowLeft', 'Ensure this value is less than or equal to 14.'],
    [{ untilBreak: '8:15' }, 'untilBreak', 'Ensure this value is less than or equal to 8.'],
    [{ cycleLeft: '70:30' }, 'cycleLeft', 'Ensure this value is less than or equal to 70.'],
    [
      { cycle: '60h_7d', cycleLeft: '60:30' },
      'cycleLeft',
      'Ensure this value is less than or equal to 60.',
    ],
    [{ driveLeft: '' }, 'driveLeft', 'This field is required.'],
    [{ driveLeft: '9h' }, 'driveLeft', HOS_MESSAGES.clock],
    [{ windowLeft: '10:00' }, 'driveLeft', HOS_MESSAGES.driveOverLimits],
    [{ cycleLeft: '9:30' }, 'driveLeft', HOS_MESSAGES.driveOverLimits],
  ] as const)('%o fails on %s', (overrides, field, message) => {
    expect(hosErrors(on(overrides))[field]).toBe(message)
  })

  it('becomes the API block', () => {
    expect(toHosRequest(restedHos())).toEqual({ enabled: false })
    expect(toHosRequest(on({ driveLeft: '10:20', cycleLeft: '52:30' }))).toEqual({
      enabled: true,
      cycle: '70h_8d',
      drive_left_h: '10.33',
      window_left_h: '14.00',
      until_break_h: '8.00',
      cycle_left_h: '52.50',
    })
  })

  it('routes API HOS errors to clocks', () => {
    expect(hosFieldFor('hos.drive_left_h')).toBe('driveLeft')
    expect(hosFieldFor('hos.cycle')).toBe('cycle')
    expect(hosFieldFor('hos.enabled')).toBeNull()
  })
})

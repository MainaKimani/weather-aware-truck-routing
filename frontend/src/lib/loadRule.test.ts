import { describe, expect, it } from 'vitest'

import type { Plan } from '../api/schema'
import { describeLoadRule } from './loadRule'

type Risk = Plan['routes'][number]['checkpoints'][number]['risk']

const risk = (overrides: Partial<Risk>): Risk => ({
  level: 'SEVERE',
  driver: 'wind',
  wind: 'HIGH',
  wind_adjusted: 'SEVERE',
  rain: 'LOW',
  snow: 'LOW',
  load_rule: 'wind_35_44_over_40k',
  ...overrides,
})

describe('describeLoadRule', () => {
  it('says which levels, gust, load and rule were involved', () => {
    expect(describeLoadRule(risk({}), 38, 42_000)).toBe(
      'Raised High → Severe: gust 38 mph with a 42,000 lb load (> 40,000 lb rule)',
    )
  })

  it('names the 30,000 lb rule for the stronger gust band', () => {
    expect(
      describeLoadRule(
        risk({ wind: 'SEVERE', wind_adjusted: 'NO_TRAVEL', load_rule: 'wind_45_54_over_30k' }),
        49.6,
        35_000,
      ),
    ).toBe('Raised Severe → No travel: gust 50 mph with a 35,000 lb load (> 30,000 lb rule)')
  })

  it('is null when no rule applied', () => {
    expect(describeLoadRule(risk({ load_rule: null }), 38, 42_000)).toBeNull()
  })

  it('still reads without a gust value', () => {
    expect(describeLoadRule(risk({}), null, 42_000)).toBe(
      'Raised High → Severe: gusts with a 42,000 lb load (> 40,000 lb rule)',
    )
  })
})

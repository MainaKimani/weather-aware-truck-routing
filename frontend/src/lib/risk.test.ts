import { describe, expect, it } from 'vitest'

import { riskLevelEnumValues } from '../api/schema'
import { RISK, RISK_LEVELS, applyRiskVariables, riskCssVariables, riskStyle } from './risk'

describe('risk styles', () => {
  it('covers every level in the API contract, in order of severity', () => {
    expect(RISK_LEVELS).toEqual(riskLevelEnumValues)
    expect(RISK_LEVELS.map((level) => RISK[level].score)).toEqual([0, 1, 2, 3, 4])
  })

  it('gives every level a distinct colour and a label', () => {
    const colours = Object.values(RISK).map((style) => style.color)
    expect(new Set(colours).size).toBe(colours.length)
    expect(RISK.NO_TRAVEL.label).toBe('No travel')
  })

  it('treats a missing level as Unknown, never Low', () => {
    expect(riskStyle(null)).toBe(RISK.UNKNOWN)
    expect(riskStyle(undefined)).toBe(RISK.UNKNOWN)
    expect(riskStyle(null).score).toBeNull()
    expect(riskStyle('LOW')).toBe(RISK.LOW)
  })

  it('exposes colours as CSS variables for the stylesheet', () => {
    const vars = riskCssVariables()
    expect(vars['--risk-no-travel']).toBe(RISK.NO_TRAVEL.color)
    expect(vars['--risk-unknown-ink']).toBe(RISK.UNKNOWN.ink)
    expect(Object.keys(vars)).toHaveLength(12)

    const root = document.createElement('div')
    applyRiskVariables(root)
    expect(root.style.getPropertyValue('--risk-severe')).toBe(RISK.SEVERE.color)
  })
})

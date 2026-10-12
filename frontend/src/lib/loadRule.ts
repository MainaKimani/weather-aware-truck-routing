/**
 * The heavy-load wind rules (PRD §7.5) in words. A rule raises the wind level
 * one step when the load is over its threshold and the gust is in its band;
 * the API says which rule fired, and this says why.
 */
import type { LoadRuleEnum, Plan } from '../api/schema'
import { riskStyle } from './risk'

type Risk = Plan['routes'][number]['checkpoints'][number]['risk']

/** The load each rule applies above, in pounds. */
export const LOAD_RULE_THRESHOLD_LB: Readonly<Record<LoadRuleEnum, number>> = {
  wind_35_44_over_40k: 40_000,
  wind_45_54_over_30k: 30_000,
}

const pounds = (lb: number) => `${lb.toLocaleString('en-US')} lb`

/**
 * "Raised High → Severe: gust 38 mph with a 42,000 lb load (> 40,000 lb
 * rule)", or null when no rule changed the level.
 */
export function describeLoadRule(
  risk: Risk,
  gustMph: number | null | undefined,
  loadLb: number,
): string | null {
  if (!risk.load_rule || !risk.wind || !risk.wind_adjusted) return null
  const from = riskStyle(risk.wind).label
  const to = riskStyle(risk.wind_adjusted).label
  const gust =
    gustMph === null || gustMph === undefined ? 'gusts' : `gust ${gustMph.toFixed(0)} mph`
  const threshold = pounds(LOAD_RULE_THRESHOLD_LB[risk.load_rule])
  return `Raised ${from} → ${to}: ${gust} with a ${pounds(loadLb)} load (> ${threshold} rule)`
}

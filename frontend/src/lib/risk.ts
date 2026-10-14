/**
 * Risk levels as the UI and the map show them: the one place risk colours,
 * labels and scores are defined (RFC §10.6).
 *
 * The palette runs soft green → yellow → amber → red, then near-black for No
 * travel: the traffic-light order drivers already read. Red and green alone
 * are hard to tell apart for many colour-blind people, so the steps also
 * differ in lightness (light green and yellow, mid amber, dark red, near-black)
 * and every use pairs the colour with its label. Unknown is a neutral grey,
 * outside the scale, because missing data must never look like a level.
 */
import { riskLevelEnumValues, type RiskLevelEnum } from '../api/schema'

export type RiskLevel = RiskLevelEnum
export type RiskBucket = RiskLevel | 'UNKNOWN'

export interface RiskStyle {
  readonly label: string
  /** 0 (Low) to 4 (No travel); null for Unknown. */
  readonly score: number | null
  /** Fill colour for chips, bars, map circles and heatmap cells. */
  readonly color: string
  /** Text colour that stays readable on `color`. */
  readonly ink: string
}

const DARK_INK = '#1c1917'
const LIGHT_INK = '#ffffff'

export const RISK: Readonly<Record<RiskBucket, RiskStyle>> = {
  LOW: { label: 'Low', score: 0, color: '#9fd8a6', ink: DARK_INK },
  MODERATE: { label: 'Moderate', score: 1, color: '#fcd34d', ink: DARK_INK },
  HIGH: { label: 'High', score: 2, color: '#f59e0b', ink: DARK_INK },
  SEVERE: { label: 'Severe', score: 3, color: '#dc2626', ink: LIGHT_INK },
  NO_TRAVEL: { label: 'No travel', score: 4, color: '#1c1917', ink: LIGHT_INK },
  UNKNOWN: { label: 'Unknown', score: null, color: '#9ca3af', ink: DARK_INK },
}

/** Levels from least to most severe, straight from the API contract. */
export const RISK_LEVELS: readonly RiskLevel[] = riskLevelEnumValues

/** The style for a level from the API, where null means no forecast (Unknown). */
export function riskStyle(level: RiskLevel | null | undefined): RiskStyle {
  return RISK[level ?? 'UNKNOWN']
}

/** CSS custom properties (`--risk-low`, `--risk-low-ink`, …) for stylesheets and Tailwind. */
export function riskCssVariables(): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [bucket, style] of Object.entries(RISK)) {
    const name = `--risk-${bucket.toLowerCase().replaceAll('_', '-')}`
    vars[name] = style.color
    vars[`${name}-ink`] = style.ink
  }
  return vars
}

export function applyRiskVariables(root: HTMLElement): void {
  for (const [name, value] of Object.entries(riskCssVariables())) {
    root.style.setProperty(name, value)
  }
}

import type { RiskLevelEnum } from '../../api/schema'
import { riskStyle } from '../../lib/risk'

/** A risk level as a coloured chip with its name, so colour is never the only cue. */
export function RiskChip({ level }: { level: RiskLevelEnum | null }) {
  const style = riskStyle(level)
  return (
    <span
      className="rounded px-1.5 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.color, color: style.ink }}
    >
      {style.label}
    </span>
  )
}

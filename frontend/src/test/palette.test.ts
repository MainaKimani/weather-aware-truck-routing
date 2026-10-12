/**
 * Risk colours have one source, src/lib/risk.ts. This fails if a component
 * or stylesheet hard-codes a colour instead of using the tokens.
 */
import { describe, expect, it } from 'vitest'

import { RISK } from '../lib/risk'

const sources = import.meta.glob<string>(['/src/**/*.{ts,tsx,css}', '!/src/api/schema.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
})
const HEX = /#[0-9a-f]{3,8}\b/i

describe('colour sources', () => {
  it('finds the source files', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5)
  })

  it('defines risk colours only in lib/risk.ts', () => {
    const palette = Object.values(RISK).map((style) => style.color.toLowerCase())
    const offenders = Object.entries(sources)
      .filter(([path]) => !path.endsWith('/lib/risk.ts') && !path.endsWith('.test.ts'))
      .filter(([, text]) => palette.some((colour) => text.toLowerCase().includes(colour)))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })

  it('has no hex colours in components or modules other than lib/risk.ts', () => {
    const offenders = Object.entries(sources)
      .filter(([path]) => /\.tsx?$/.test(path) && !path.endsWith('/lib/risk.ts'))
      .filter(([path]) => !/\.test\.tsx?$/.test(path))
      .filter(([, text]) => HEX.test(text))
      .map(([path]) => path)
    expect(offenders).toEqual([])
  })
})

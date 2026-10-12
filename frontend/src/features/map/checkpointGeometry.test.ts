import { describe, expect, it } from 'vitest'

import type { Plan } from '../../api/schema'
import { at } from '../../test/at'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { buildCheckpoints } from './checkpointGeometry'

describe('buildCheckpoints', () => {
  const plan: Plan = demoPlan
  const geometry = buildCheckpoints(plan.routes)
  const total = plan.routes.reduce((n, r) => n + r.checkpoints.length, 0)

  it('has every route’s checkpoints, each with a unique numeric id', () => {
    const ids = geometry.data.features.map((f) => f.id)
    expect(ids).toHaveLength(total)
    expect(new Set(ids).size).toBe(total)
    expect(ids.every((id) => typeof id === 'number')).toBe(true)
  })

  it('keeps each checkpoint’s position, route, index and level (null as Unknown)', () => {
    const cp = at(at(plan.routes, 1).checkpoints, 13)
    const id = geometry.idOf({ routeId: 'r2', index: 13 })
    const feature = geometry.data.features.find((f) => f.id === id)

    expect(feature?.geometry.coordinates).toEqual([cp.lon, cp.lat])
    expect(feature?.properties).toEqual({
      route: 'r2',
      index: 13,
      level: cp.risk.level ?? 'UNKNOWN',
    })
  })

  it('finds no id for a checkpoint outside the plan', () => {
    expect(geometry.idOf({ routeId: 'r9', index: 0 })).toBeNull()
    expect(geometry.idOf({ routeId: 'r1', index: -1 })).toBeNull()
    expect(geometry.idOf({ routeId: 'r1', index: 10_000 })).toBeNull()
  })
})

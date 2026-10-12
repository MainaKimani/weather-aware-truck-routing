import { describe, expect, it } from 'vitest'

import { MAX_HOUR, useTimelineStore } from './timeline'
import { useUiStore } from './ui'

describe('timeline store', () => {
  it('keeps the hour a whole number within 0-48', () => {
    const { setHour, step } = useTimelineStore.getState()

    setHour(12.6)
    expect(useTimelineStore.getState().hour).toBe(13)
    setHour(99)
    expect(useTimelineStore.getState().hour).toBe(MAX_HOUR)
    step(-100)
    expect(useTimelineStore.getState().hour).toBe(0)
  })
})

describe('ui store', () => {
  it('selecting a checkpoint selects its route', () => {
    useUiStore.getState().selectCheckpoint({ routeId: 'r2', index: 4 })

    expect(useUiStore.getState()).toMatchObject({
      selectedRouteId: 'r2',
      selectedCheckpoint: { routeId: 'r2', index: 4 },
    })
  })

  it('selecting another route clears the selected checkpoint', () => {
    const ui = useUiStore.getState()
    ui.selectCheckpoint({ routeId: 'r2', index: 4 })
    ui.selectRoute('r1')

    expect(useUiStore.getState().selectedCheckpoint).toBeNull()
  })

  it('a new plan clears pointers but keeps layer choices', () => {
    const ui = useUiStore.getState()
    ui.toggleLayer('heatmap')
    ui.hoverCheckpoint({ routeId: 'r2', index: 1 })
    ui.showPlan('r1')

    expect(useUiStore.getState()).toMatchObject({
      selectedRouteId: 'r1',
      hoveredCheckpoint: null,
      layers: { heatmap: false, checkpoints: true, alternatives: true },
    })
  })
})

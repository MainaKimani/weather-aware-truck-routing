import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Plan } from '../../api/schema'
import { formatClockTime } from '../../lib/format'
import { useUiStore } from '../../state/ui'
import { at, required } from '../../test/at'
import { fake, fireMap, layer, source } from '../../test/fakeMap'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { renderMap } from '../../test/renderMap'
import { buildCheckpoints } from './checkpointGeometry'
import { LAYER, SOURCE, routeIs } from './layers'

const ids = buildCheckpoints(demoPlan.routes)
const idOf = (routeId: string, index: number) => ids.idOf({ routeId, index })
const target = (routeId: string, index: number) => ({
  source: SOURCE.checkpoints,
  id: idOf(routeId, index),
})

const plan: Plan = demoPlan
const checkpoint = (route: number, index: number) => at(at(plan.routes, route).checkpoints, index)

// Route B's first checkpoint raised by the heavy-load wind rule.
const routeB = at(plan.routes, 1)
const loadRuleIndex = routeB.checkpoints.findIndex((cp) => cp.risk.load_rule !== null)

const checkpointFeature = (routeId: string, index: number) => ({
  layer: { id: LAYER.checkpoints },
  properties: { route: routeId, index },
})

describe('checkpoints layer', () => {
  it('shows the selected route’s checkpoints and switches route by filter, not data', () => {
    renderMap(demoPlan)
    expect(layer(LAYER.checkpoints).filter).toEqual(routeIs('r1'))

    act(() => {
      useUiStore.getState().selectRoute('r2')
    })

    expect(layer(LAYER.checkpoints).filter).toEqual(routeIs('r2'))
    expect(source(SOURCE.checkpoints).setData).not.toHaveBeenCalled()
  })

  it('highlights the hovered checkpoint with feature-state, clearing the previous one', () => {
    renderMap(demoPlan)

    act(() => {
      useUiStore.getState().hoverCheckpoint({ routeId: 'r1', index: 3 })
    })
    expect(fake.map.setFeatureState).toHaveBeenLastCalledWith(target('r1', 3), { hover: true })

    act(() => {
      useUiStore.getState().hoverCheckpoint({ routeId: 'r1', index: 4 })
    })
    expect(fake.map.removeFeatureState).toHaveBeenLastCalledWith(target('r1', 3), 'hover')
    expect(fake.map.setFeatureState).toHaveBeenLastCalledWith(target('r1', 4), { hover: true })
    expect(source(SOURCE.checkpoints).setData).not.toHaveBeenCalled()
  })

  it('marks the selected checkpoint, and marks it again when a new basemap re-adds the source', () => {
    renderMap(demoPlan)

    act(() => {
      useUiStore.getState().selectCheckpoint({ routeId: 'r2', index: 5 })
    })
    expect(fake.map.setFeatureState).toHaveBeenLastCalledWith(target('r2', 5), { selected: true })

    fake.map.setFeatureState.mockClear()
    for (const [event, handler] of fake.map.on.mock.calls as [string, (e: object) => void][]) {
      if (event === 'sourcedata') {
        handler({ sourceId: SOURCE.checkpoints, sourceDataType: 'content' })
        handler({ sourceId: SOURCE.checkpoints, sourceDataType: 'metadata' })
      }
    }
    expect(fake.map.setFeatureState).toHaveBeenCalledTimes(1)
    expect(fake.map.setFeatureState).toHaveBeenCalledWith(target('r2', 5), { selected: true })
  })
})

describe('checkpoint tooltip and popup', () => {
  it('shows the level and ETA for the hovered checkpoint, from the table or the map', () => {
    renderMap(demoPlan)
    const cp = checkpoint(0, 2)

    act(() => {
      useUiStore.getState().hoverCheckpoint({ routeId: 'r1', index: 2 })
    })

    const tooltip = screen.getByTestId('popup')
    expect(tooltip).toHaveTextContent(`Low${formatClockTime(cp.eta, 'America/Chicago')}`)
    expect(within(tooltip).queryByRole('button', { name: 'Close popup' })).not.toBeInTheDocument()
  })

  it('details the selected checkpoint, with the load rule in words', () => {
    renderMap(demoPlan)
    const cp = at(routeB.checkpoints, loadRuleIndex)
    const forecast = required(cp.forecast, 'forecast')
    const gust = required(forecast.gust_mph, 'gust').toFixed(0)
    const sustained = required(forecast.wind_mph, 'sustained wind').toFixed(0)

    act(() => {
      useUiStore.getState().selectCheckpoint({ routeId: 'r2', index: loadRuleIndex })
    })

    const popup = screen.getByRole('region', {
      name: `Checkpoint at mile ${String(Math.round(cp.mile))}`,
    })
    const text = popup.textContent
    expect(text).toContain(`Mile ${String(Math.round(cp.mile))} · Route B`)
    expect(text).toContain(`ETA${formatClockTime(cp.eta, 'America/Chicago')}`)
    expect(text).toContain(`Gust${gust} mph`)
    expect(text).toContain(`Sustained${sustained} mph (for info)`)
    expect(text).toContain('RiskSevere from gusts')
    expect(text).toContain(
      `Raised High → Severe: gust ${gust} mph with a 42,000 lb load (> 40,000 lb rule)`,
    )
  })

  it('shows one popup, not a tooltip too, for a checkpoint both hovered and selected', () => {
    renderMap(demoPlan)

    act(() => {
      useUiStore.getState().selectCheckpoint({ routeId: 'r1', index: 1 })
      useUiStore.getState().hoverCheckpoint({ routeId: 'r1', index: 1 })
    })

    expect(screen.getAllByTestId('popup')).toHaveLength(1)
  })

  it('closes the popup, keeping the route, with its close button', async () => {
    renderMap(demoPlan)
    act(() => {
      useUiStore.getState().selectCheckpoint({ routeId: 'r2', index: 1 })
    })

    await userEvent.click(screen.getByRole('button', { name: 'Close popup' }))

    expect(useUiStore.getState().selectedCheckpoint).toBeNull()
    expect(useUiStore.getState().selectedRouteId).toBe('r2')
  })

  it('brings a selected checkpoint into view only if it is off screen', () => {
    renderMap(demoPlan)

    act(() => {
      useUiStore.getState().selectCheckpoint({ routeId: 'r1', index: 1 })
    })
    expect(fake.map.easeTo).not.toHaveBeenCalled()

    fake.map.getBounds.mockReturnValue({ contains: () => false })
    act(() => {
      useUiStore.getState().selectCheckpoint({ routeId: 'r1', index: 2 })
    })
    const cp = checkpoint(0, 2)
    expect(fake.map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [cp.lon, cp.lat] }),
    )
  })
})

describe('pointing at checkpoints on the map', () => {
  it('hovers and selects a checkpoint before the route beneath it', () => {
    renderMap(demoPlan)
    const features = [
      { layer: { id: LAYER.routeHit }, properties: { route: 'r1' } },
      checkpointFeature('r1', 6),
    ]

    act(() => {
      fireMap('onMouseMove', { features })
    })
    expect(useUiStore.getState().hoveredCheckpoint).toEqual({ routeId: 'r1', index: 6 })
    expect(useUiStore.getState().hoveredRouteId).toBe('r1')

    act(() => {
      fireMap('onClick', { features })
    })
    expect(useUiStore.getState().selectedCheckpoint).toEqual({ routeId: 'r1', index: 6 })
  })

  it('keeps the same hover while the pointer stays on one checkpoint', () => {
    renderMap(demoPlan)

    act(() => {
      fireMap('onMouseMove', { features: [checkpointFeature('r1', 6)] })
    })
    const first = useUiStore.getState().hoveredCheckpoint
    act(() => {
      fireMap('onMouseMove', { features: [checkpointFeature('r1', 6)] })
    })

    expect(useUiStore.getState().hoveredCheckpoint).toBe(first)
    expect(fake.map.setFeatureState).toHaveBeenCalledTimes(1)
  })

  it('closes the popup on a click on empty map', () => {
    renderMap(demoPlan)
    act(() => {
      useUiStore.getState().selectCheckpoint({ routeId: 'r2', index: 3 })
    })

    act(() => {
      fireMap('onClick', { features: [] })
    })

    expect(useUiStore.getState().selectedCheckpoint).toBeNull()
    expect(useUiStore.getState().selectedRouteId).toBe('r2')
  })
})

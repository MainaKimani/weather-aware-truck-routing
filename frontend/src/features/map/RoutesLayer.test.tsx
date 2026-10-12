import { act, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Plan } from '../../api/schema'
import { setThemePreference } from '../../lib/theme'
import { useUiStore } from '../../state/ui'
import { fake, fireMap, layer, source } from '../../test/fakeMap'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { renderMap, showPlan } from '../../test/renderMap'
import { LAYER, SOURCE, routeIs } from './layers'

const routeFeature = (route: string) => ({ layer: { id: LAYER.routeHit }, properties: { route } })

describe('routes layer', () => {
  it('draws every route, with the recommended one selected', () => {
    renderMap(demoPlan)

    expect(source(SOURCE.routes).props.data).toMatchObject({
      features: [
        { properties: { route: 'r1' } },
        { properties: { route: 'r2' } },
        { properties: { route: 'r3' } },
      ],
    })
    expect(layer(LAYER.routeSegments).filter).toEqual(routeIs('r1'))
    expect(layer(LAYER.routeCasing).filter).toEqual(routeIs('r1'))
    expect(layer(LAYER.otherRoutes).filter).toEqual(['!', routeIs('r1')])
  })

  it('changes selection and hover through filters and paint, never setData', () => {
    renderMap(demoPlan)

    act(() => {
      useUiStore.getState().selectRoute('r3')
    })
    act(() => {
      useUiStore.getState().hoverRoute('r2')
    })

    expect(layer(LAYER.routeSegments).filter).toEqual(routeIs('r3'))
    expect(layer(LAYER.otherRoutes).paint).toMatchObject({
      'line-width': ['case', routeIs('r2'), 5, 4],
    })
    expect(source(SOURCE.routes).setData).not.toHaveBeenCalled()
    expect(source(SOURCE.segments).setData).not.toHaveBeenCalled()
  })

  it('replaces the data once for a plan whose routes differ', async () => {
    const { client } = renderMap(demoPlan)
    const replanned = structuredClone<Plan>(demoPlan)
    replanned.generated_at = '2026-10-12T09:00:00Z'
    const first = replanned.routes[0]?.checkpoints[0]
    if (first) first.risk.level = 'HIGH'

    showPlan(client, replanned)

    await waitFor(() => {
      expect(source(SOURCE.routes).setData).toHaveBeenCalledTimes(1)
    })
    expect(source(SOURCE.segments).setData).toHaveBeenCalledTimes(1)
  })

  it('keeps the data when a new plan returns the same routes', async () => {
    const { client } = renderMap(demoPlan)

    showPlan(client, { ...structuredClone<Plan>(demoPlan), generated_at: '2026-10-12T09:00:00Z' })

    // The camera refits for the new plan; the routes, unchanged, aren't re-sent.
    await waitFor(() => {
      expect(fake.map.fitBounds).toHaveBeenCalledTimes(2)
    })
    expect(source(SOURCE.routes).setData).not.toHaveBeenCalled()
    expect(source(SOURCE.segments).setData).not.toHaveBeenCalled()
  })

  it("takes its line colours from the theme's tokens", () => {
    // jsdom doesn't load index.css; these stand in for its two theme blocks.
    const tokens = document.createElement('style')
    tokens.textContent = `
      :root { --map-route: rgb(1,1,1); --map-casing: rgb(2,2,2); }
      [data-theme='dark'] { --map-route: rgb(3,3,3); --map-casing: rgb(4,4,4); }`
    document.head.append(tokens)
    try {
      renderMap(demoPlan)
      expect(layer(LAYER.routeCasing).paint).toMatchObject({ 'line-color': 'rgb(2,2,2)' })

      act(() => {
        setThemePreference('dark')
      })

      expect(layer(LAYER.routeCasing).paint).toMatchObject({ 'line-color': 'rgb(4,4,4)' })
      expect(source(SOURCE.routes).setData).not.toHaveBeenCalled()
    } finally {
      tokens.remove()
    }
  })
})

describe('pointing at routes on the map', () => {
  it('hovers and selects through the store the route cards use', () => {
    renderMap(demoPlan)

    act(() => {
      fireMap('onMouseMove', { features: [routeFeature('r2')] })
    })
    expect(useUiStore.getState().hoveredRouteId).toBe('r2')

    act(() => {
      fireMap('onClick', { features: [routeFeature('r2')] })
    })
    expect(useUiStore.getState().selectedRouteId).toBe('r2')

    act(() => {
      fireMap('onMouseOut')
    })
    expect(useUiStore.getState().hoveredRouteId).toBeNull()
  })

  it('shows a pointer only over something clickable', () => {
    renderMap(demoPlan)

    act(() => {
      fireMap('onMouseMove', { features: [routeFeature('r2')] })
    })
    expect(fake.mapProps.cursor).toBe('pointer')

    act(() => {
      fireMap('onMouseMove', { features: [] })
    })
    expect(fake.mapProps.cursor).toBeUndefined()
    expect(useUiStore.getState().hoveredRouteId).toBeNull()
  })

  it('leaves the selection alone when the click misses every route', () => {
    renderMap(demoPlan)

    act(() => {
      fireMap('onClick', { features: [] })
    })

    expect(useUiStore.getState().selectedRouteId).toBe('r1')
    expect(screen.getByTestId('map')).toBeInTheDocument()
  })
})

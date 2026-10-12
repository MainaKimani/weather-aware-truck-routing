import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import type { Plan } from '../../api/schema'
import { setThemePreference } from '../../lib/theme'
import { fake, fireMap } from '../../test/fakeMap'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { setReducedMotion } from '../../test/matchMedia'
import { renderMap, showPlan } from '../../test/renderMap'
import { BASEMAP, fitPadding } from './basemap'

describe('map view', () => {
  it('shows the light basemap and a hint before anything is planned', () => {
    renderMap()

    expect(screen.getByTestId('map')).toHaveAttribute('data-style', BASEMAP.light)
    expect(screen.getByText('Routes appear here once a trip is planned.')).toBeInTheDocument()
    expect(screen.queryByTestId('marker')).not.toBeInTheDocument()
    expect(fake.map.fitBounds).not.toHaveBeenCalled()
  })

  it('switches to the dark basemap with the theme', () => {
    renderMap()

    act(() => {
      setThemePreference('dark')
    })

    expect(screen.getByTestId('map')).toHaveAttribute('data-style', BASEMAP.dark)
  })

  it('needs no access token: both basemaps are keyless public styles', () => {
    for (const url of Object.values(BASEMAP)) {
      expect(new URL(url).search).toBe('')
    }
  })

  it('fits the camera to every route when a plan arrives', () => {
    renderMap(demoPlan)

    const [west, south, east, north] = demoPlan.corridor.bbox
    expect(fake.map.fitBounds).toHaveBeenCalledTimes(1)
    expect(fake.map.fitBounds).toHaveBeenCalledWith(
      [
        [west, south],
        [east, north],
      ],
      expect.objectContaining({ padding: fitPadding(800, 600) }),
    )
    expect(screen.queryByText('Routes appear here once a trip is planned.')).not.toBeInTheDocument()
  })

  it('fits again for each new plan, and not when anything else changes', async () => {
    const { client } = renderMap(demoPlan)

    await userEvent.hover(screen.getByRole('img', { name: 'Origin: Dallas, TX' }))
    act(() => {
      setThemePreference('dark')
    })
    expect(fake.map.fitBounds).toHaveBeenCalledTimes(1)

    const replanned: Plan = {
      ...structuredClone<Plan>(demoPlan),
      generated_at: '2026-10-12T09:00:00Z',
    }
    showPlan(client, replanned)
    await waitFor(() => {
      expect(fake.map.fitBounds).toHaveBeenCalledTimes(2)
    })
  })

  it('jumps rather than flies when the user prefers reduced motion', () => {
    setReducedMotion(true)

    renderMap(demoPlan)

    expect(fake.map.fitBounds).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ duration: 0 }),
    )
  })

  it('pins the origin and destination', () => {
    renderMap(demoPlan)

    const { origin, destination } = demoPlan.inputs
    const origins = screen.getByRole('img', { name: 'Origin: Dallas, TX' })
    const destinations = screen.getByRole('img', { name: 'Destination: Denver, CO' })
    expect(origins.closest('[data-testid=marker]')).toHaveAttribute(
      'data-lnglat',
      `${String(origin.lon)},${String(origin.lat)}`,
    )
    expect(destinations.closest('[data-testid=marker]')).toHaveAttribute(
      'data-lnglat',
      `${String(destination.lon)},${String(destination.lat)}`,
    )
  })

  it('says so, and points to the panel, when the map cannot start', () => {
    renderMap(demoPlan)

    act(() => {
      fireMap('onError', { type: 'error', target: null, error: new Error('WebGL unavailable') })
    })

    expect(screen.getByRole('status')).toHaveTextContent(
      "The map couldn't start in this browser (it needs WebGL).",
    )
    expect(screen.queryByTestId('map')).not.toBeInTheDocument()
  })

  it('keeps the map up when a tile fails to load', () => {
    renderMap(demoPlan)

    act(() => {
      fireMap('onError', { type: 'error', target: fake.map, error: new Error('tile 404') })
    })

    expect(screen.getByTestId('map')).toBeInTheDocument()
  })
})

describe('fit padding', () => {
  it('keeps a fixed margin on a large map, shrinks on a small one, and clears the pin', () => {
    expect(fitPadding(1200, 800)).toEqual({ top: 56 + 32, right: 56, bottom: 56, left: 56 })
    expect(fitPadding(320, 240)).toEqual({ top: 29 + 32, right: 29, bottom: 29, left: 29 })
  })
})

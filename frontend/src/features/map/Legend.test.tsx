import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { useUiStore } from '../../state/ui'
import { layer, source } from '../../test/fakeMap'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { renderMap } from '../../test/renderMap'
import { LAYER, SOURCE, routeIs } from './layers'

const legend = () => screen.getByRole('region', { name: 'Legend' })

describe('map legend', () => {
  it('appears once a trip is planned', () => {
    renderMap()
    expect(screen.queryByRole('region', { name: 'Legend' })).not.toBeInTheDocument()
  })

  it('names all six levels, least to most severe, then Unknown', () => {
    renderMap(demoPlan)

    const levels = within(legend()).getByRole('list', { name: 'Risk levels' })
    expect(
      within(levels)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Low', 'Moderate', 'High', 'Severe', 'No travel', 'Unknown'])
  })

  it('collapses and expands', async () => {
    renderMap(demoPlan)
    const toggle = within(legend()).getByRole('button', { name: 'Legend' })

    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(within(legend()).queryByRole('list', { name: 'Risk levels' })).not.toBeInTheDocument()

    await userEvent.click(toggle)
    expect(within(legend()).getByRole('list', { name: 'Risk levels' })).toBeInTheDocument()
  })
})

describe('layer switches', () => {
  it('switch the heatmap, the checkpoints and the other routes, all on to start', () => {
    renderMap(demoPlan)

    const switches = within(legend()).getAllByRole('checkbox')
    expect(switches.map((s) => s.closest('label')?.textContent)).toEqual([
      'Heatmap',
      'Checkpoints',
      'Other routes',
    ])
    switches.forEach((s) => {
      expect(s).toBeChecked()
    })
  })

  it('hide and show the checkpoints by visibility alone', async () => {
    renderMap(demoPlan)
    expect(layer(LAYER.checkpoints).layout).toEqual({ visibility: 'visible' })

    await userEvent.click(screen.getByRole('checkbox', { name: 'Checkpoints' }))
    expect(layer(LAYER.checkpoints).layout).toEqual({ visibility: 'none' })

    await userEvent.click(screen.getByRole('checkbox', { name: 'Checkpoints' }))
    expect(layer(LAYER.checkpoints).layout).toEqual({ visibility: 'visible' })
    expect(source(SOURCE.checkpoints).setData).not.toHaveBeenCalled()
  })

  it('hide the other routes, which then cannot be hovered either', async () => {
    renderMap(demoPlan)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Other routes' }))

    expect(screen.getByRole('checkbox', { name: 'Other routes' })).not.toBeChecked()
    expect(layer(LAYER.otherRoutes).layout).toMatchObject({ visibility: 'none' })
    expect(layer(LAYER.routeHit).filter).toEqual(routeIs('r1'))
    expect(layer(LAYER.routeSegments).filter).toEqual(routeIs('r1'))
    expect(source(SOURCE.routes).setData).not.toHaveBeenCalled()
    expect(source(SOURCE.segments).setData).not.toHaveBeenCalled()
  })
})

describe('heatmap metric choice', () => {
  const choice = () => within(legend()).getByRole('group', { name: 'Heatmap shows' })

  it('offers the overall rating and each condition, starting on the rating', () => {
    renderMap(demoPlan)

    const radios = within(choice()).getAllByRole('radio')
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual([
      'Risk',
      'Wind',
      'Rain',
      'Snow',
    ])
    expect(within(choice()).getByRole('radio', { name: 'Risk' })).toBeChecked()
    expect(choice()).toHaveTextContent('The overall rating, as on the checkpoints.')
  })

  it('says what a condition shows once its levels are in', async () => {
    renderMap(demoPlan)

    await userEvent.click(within(choice()).getByRole('radio', { name: 'Wind' }))

    expect(useUiStore.getState().heatmapMetric).toBe('wind')
    expect(await within(choice()).findByText("Gusts, with this load's wind rules.")).toBeVisible()
  })

  it('is off while the heatmap is hidden', async () => {
    renderMap(demoPlan)

    await userEvent.click(screen.getByRole('checkbox', { name: 'Heatmap' }))

    expect(choice()).toBeDisabled()
  })
})

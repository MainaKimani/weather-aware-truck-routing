import { render, screen, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { planKeys } from '../../api/plans'
import { AppProviders } from '../../app/AppProviders'
import { demoHeatmap } from '../../test/fixtures/demoHeatmap'
import { demoPlan } from '../../test/fixtures/demoPlan'
import { freshClient } from '../../test/render'
import { HEATMAP, server } from '../../test/server'
import { Toaster } from '../shell/Toaster'
import { HEATMAP_NOTICE, HeatmapNotice, SHOW_AFTER_MS } from './HeatmapNotice'

function renderNotice(heatmapAfterMs: number) {
  server.use(
    http.get(HEATMAP, async () => {
      await delay(heatmapAfterMs)
      return HttpResponse.json(demoHeatmap)
    }),
  )
  const client = freshClient()
  client.setQueryData(planKeys.current(), demoPlan)
  render(
    <AppProviders queryClient={client}>
      <HeatmapNotice />
      <Toaster />
    </AppProviders>,
  )
}

describe('heatmap notice', () => {
  it('says the heatmap is being generated, then goes when it arrives', async () => {
    renderNotice(SHOW_AFTER_MS + 800)

    expect(
      await screen.findByText(HEATMAP_NOTICE, {}, { timeout: SHOW_AFTER_MS + 600 }),
    ).toBeVisible()
    await waitFor(
      () => {
        expect(screen.queryByText(HEATMAP_NOTICE)).toBeNull()
      },
      { timeout: 2000 },
    )
  })

  it('stays quiet when the heatmap is already there', async () => {
    renderNotice(50)

    await new Promise((resolve) => setTimeout(resolve, SHOW_AFTER_MS + 300))
    expect(screen.queryByText(HEATMAP_NOTICE)).toBeNull()
  })
})

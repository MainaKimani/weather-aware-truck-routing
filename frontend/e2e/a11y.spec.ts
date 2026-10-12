/**
 * axe on every state of the planner, in both themes: no serious or critical
 * violations. The map's canvas is drawn pixels, which axe can't read; what
 * the map shows is also in the panel, the legend and labelled markers.
 */
import { expect, test } from '@playwright/test'

import { strongHosPlan } from '../src/test/fixtures/strongHosPlan'
import { expectAccessible, planDemoTrip, respondToPlanWith } from './support'

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.use({ colorScheme: theme })

    test('empty form and its validation errors', async ({ page }) => {
      await page.goto('/')
      await expectAccessible(page, 'empty')

      await page.getByRole('button', { name: 'Plan trip' }).click()
      await expect(page.getByText('This field is required.').first()).toBeVisible()
      await expectAccessible(page, 'validation errors')
    })

    test('loading, then results with a checkpoint open', async ({ page }) => {
      let release: () => void = () => undefined
      const held = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('**/api/v1/plans', async (route) => {
        await held
        await route.continue()
      })
      await page.goto('/')
      await page.getByRole('button', { name: 'Use the demo trip' }).click()
      await page.getByRole('button', { name: 'Plan trip' }).click()
      await expect(page.getByText('Evaluating weather corridors…')).toBeVisible()
      await expectAccessible(page, 'loading')

      release()
      await expect(page.getByRole('region', { name: 'Legend' })).toBeVisible()
      await expectAccessible(page, 'results')

      await page.getByRole('row').nth(2).click()
      await expect(page.getByRole('region', { name: /^Checkpoint at mile/ })).toBeVisible()
      await expectAccessible(page, 'checkpoint popup')
    })

    test('a condition on the heatmap, and the hidden heatmap', async ({ page }) => {
      await page.goto('/')
      await planDemoTrip(page)

      await page.getByRole('radio', { name: 'Wind' }).check()
      await expect(page.getByText("Gusts, with this load's wind rules.")).toBeVisible()
      await expectAccessible(page, 'wind on the heatmap')

      await page.getByRole('checkbox', { name: 'Heatmap' }).uncheck()
      await expectAccessible(page, 'heatmap hidden')
    })

    test('Hours of Service with a stop open', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'Use the demo trip' }).click()
      await page.getByRole('switch', { name: 'Hours of Service' }).click()
      await expectAccessible(page, 'HOS fields')

      await page.getByRole('button', { name: 'Plan trip' }).click()
      await expect(page.getByRole('region', { name: 'Legend' })).toBeVisible()
      await page
        .getByRole('button', { name: /^(Break|Rest|Restart) / })
        .first()
        .click()
      await expect(page.getByRole('region', { name: /stop$/ })).toBeVisible()
      await expectAccessible(page, 'HOS stop popup')
    })

    test('a route that is not drivable', async ({ page }) => {
      await respondToPlanWith(page, strongHosPlan)
      await page.goto('/')
      await page.getByRole('button', { name: 'Use the demo trip' }).click()
      await page.getByRole('button', { name: 'Plan trip' }).click()
      await expect(page.getByText('Not drivable')).toBeVisible()
      await expectAccessible(page, 'not drivable')
    })

    test('a failed plan', async ({ page }) => {
      await page.route('**/api/v1/plans', (route) =>
        route.fulfill({
          status: 502,
          json: { error: { code: 'routing_unavailable', message: 'The routing service is down.' } },
        }),
      )
      await page.goto('/')
      await page.getByRole('button', { name: 'Use the demo trip' }).click()
      await page.getByRole('button', { name: 'Plan trip' }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expectAccessible(page, 'failed plan')
    })
  })
}

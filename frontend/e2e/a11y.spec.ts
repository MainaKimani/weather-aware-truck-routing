/**
 * axe on every state of the planner, in both themes: no serious or critical
 * violations. The map's canvas is drawn pixels, which axe can't read; what
 * the map shows is also in the panel, the legend and labelled markers.
 */
import { expect, test } from '@playwright/test'

import { strongHosPlan } from '../src/test/fixtures/strongHosPlan'
import { expectAccessible, planDemoTrip, respondToPlanWith, signUp, uniqueEmail } from './support'

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

    test('a guest: recent trips open, and asked to sign up to save', async ({ page }) => {
      await page.goto('/')
      await planDemoTrip(page)
      await page.getByRole('button', { name: /^Recent trips/ }).click()
      await expect(
        page.getByRole('region', { name: 'Recent trips' }).getByRole('link').first(),
      ).toBeVisible()
      await expectAccessible(page, 'recent trips')

      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: '☆ Save' }).click()
      await expect(
        page.getByRole('dialog', { name: 'Create an account to save trips' }),
      ).toBeVisible()
      await expectAccessible(page, 'sign up to save')
    })

    test('log in with a wrong password, and sign up', async ({ page }) => {
      await page.goto('/login')
      await page.getByLabel('Email').fill(uniqueEmail())
      await page.getByLabel('Password').fill('not-the-password-1')
      await page.getByRole('button', { name: 'Log in' }).click()
      await expect(page.getByRole('alert').first()).toBeVisible()
      await expectAccessible(page, 'login error')

      await page.goto('/signup')
      await expectAccessible(page, 'sign up')
    })

    test('a user: My trips, deleting, saving and sharing', async ({ page, browser }) => {
      await signUp(page)
      await page.goto('/')
      await planDemoTrip(page)
      const tripUrl = page.url()
      await page.getByRole('button', { name: '☆ Save' }).click()
      await expect(page.getByRole('form', { name: 'Save trip' })).toBeVisible()
      await expectAccessible(page, 'save form')
      await page.getByRole('button', { name: 'Save trip' }).click()
      await page.getByRole('switch', { name: 'Share' }).click()
      await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
      await expectAccessible(page, 'saved and shared trip')

      await page.getByRole('link', { name: 'My trips' }).click()
      await expect(page.getByRole('list', { name: 'Trips' }).getByRole('listitem')).toHaveCount(1)
      await expectAccessible(page, 'my trips')
      await page.getByRole('button', { name: /^Delete:/ }).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await expectAccessible(page, 'delete dialog')

      const stranger = await browser.newContext({ colorScheme: theme })
      const theirs = await stranger.newPage()
      await theirs.goto(tripUrl)
      await expect(theirs.getByText(/Shared with you, read-only/)).toBeVisible()
      await expectAccessible(theirs, 'shared trip, read-only')
      await stranger.close()
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

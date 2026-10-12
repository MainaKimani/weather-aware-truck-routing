/**
 * The PRD's user stories with the keyboard alone (PRD §6, stories 1-7):
 * every control is reached with Tab and used with Enter, Space, the arrows,
 * Home and End. Nothing here clicks. Stories 8-11 need accounts and trip
 * pages, which don't exist yet.
 */
import { expect, test, type Page } from '@playwright/test'

import { strongHosPlan } from '../src/test/fixtures/strongHosPlan'
import { respondToPlanWith, tabTo } from './support'

/** Story 1: the form, filled with the keyboard, then submitted. */
async function planByKeyboard(page: Page, { hos = false } = {}) {
  await page.goto('/')
  await choosePlace(page, 'Origin', 'Dal', 'Dallas, TX')
  await choosePlace(page, 'Destination', 'Den', 'Denver, CO')
  await tabTo(page, page.getByRole('textbox', { name: /Load weight/ }))
  await page.keyboard.type('42000')
  if (hos) {
    await tabTo(page, page.getByRole('switch', { name: 'Hours of Service' }))
    await page.keyboard.press('Space')
    await expect(page.getByRole('switch', { name: 'Hours of Service' })).toBeChecked()
  }
  await tabTo(page, page.getByRole('button', { name: 'Plan trip' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list', { name: 'Ranked routes' }).getByRole('listitem')).toHaveCount(
    3,
  )
}

async function choosePlace(page: Page, field: string, typed: string, place: string) {
  await tabTo(page, page.getByRole('combobox', { name: field }))
  await page.keyboard.type(typed)
  await expect(page.getByRole('option', { name: place })).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('combobox', { name: field })).toHaveValue(place)
}

test('stories 1-5: plan, read the pick, open checkpoints, see the load rule, scrub', async ({
  page,
}) => {
  // Five stories in one walk, a key at a time; about 15 s locally, twice that on CI runners.
  test.setTimeout(60_000)
  await planByKeyboard(page)

  // 2: the recommendation and its reason.
  const routes = page.getByRole('list', { name: 'Ranked routes' })
  await expect(routes.getByRole('listitem').first()).toContainText('Recommended')
  await expect(page.getByText('Fewest severe miles')).toBeVisible()

  // 3: a checkpoint's time, weather and rule.
  await tabTo(page, page.getByRole('row').nth(1))
  await page.keyboard.press('Enter')
  const popup = page.getByRole('region', { name: /^Checkpoint at mile 0$/ })
  await expect(popup).toBeVisible()
  await expect(popup).toContainText(/gust/i)

  // 4: Route B, chosen with the keyboard, has checkpoints a heavy load made worse.
  // Back up from the table to the route cards above it.
  await tabTo(page, page.getByRole('button', { name: /^Route B/ }), { backwards: true })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Checkpoints · Route B' })).toBeVisible()
  const loadRow = page.getByRole('row').filter({ hasText: /load/ }).first()
  await tabTo(page, loadRow, { limit: 200 })
  await page.keyboard.press('Enter')
  await expect(
    page.getByText(/^Raised \w+ → \w+: gust \d+ mph with a 42,000 lb load/),
  ).toBeVisible()

  // 5: the forecast, hour by hour.
  await tabTo(page, page.getByRole('slider', { name: 'Forecast' }))
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('slider', { name: 'Forecast' })).toHaveValue('2')
  await page.keyboard.press('End')
  await expect(page.getByRole('slider', { name: 'Forecast' })).toHaveValue('48')
  await tabTo(page, page.getByRole('button', { name: 'Play forecast' }))
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Pause forecast' })).toBeVisible()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Play forecast' })).toBeVisible()

  // The heatmap's condition and layers, from the legend.
  await tabTo(page, page.getByRole('radio', { name: 'Risk' }))
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('radio', { name: 'Wind' })).toBeChecked()
  await tabTo(page, page.getByRole('checkbox', { name: 'Checkpoints' }))
  await page.keyboard.press('Space')
  await expect(page.getByRole('checkbox', { name: 'Checkpoints' })).not.toBeChecked()
})

test('story 6: a route that is not drivable says so', async ({ page }) => {
  await respondToPlanWith(page, strongHosPlan)
  await planByKeyboard(page)

  const routeB = page.getByRole('button', { name: /^Route B/ })
  await tabTo(page, routeB)
  await expect(routeB).toContainText('Not drivable')
})

test('story 7: Hours of Service on, and a stop opened', async ({ page }) => {
  await planByKeyboard(page, { hos: true })

  const stop = page.getByRole('button', { name: /^(Break|Rest|Restart) / }).first()
  await tabTo(page, stop, { limit: 200 })
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: /stop$/ })).toBeVisible()
})

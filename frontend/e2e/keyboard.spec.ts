/**
 * The PRD's user stories with the keyboard alone (PRD §6, stories 1-7):
 * every control is reached with Tab and used with Enter, Space, the arrows,
 * Home and End. Nothing here clicks. Stories 8-11 need accounts and trip
 * pages: those are walked through below as well (stories 8-11).
 */
import { expect, test, type Page } from '@playwright/test'

import { strongHosPlan } from '../src/test/fixtures/strongHosPlan'
import { respondToPlanWith, tabTo, uniqueEmail } from './support'

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

test('story 8: a guest comes back to a recent trip from the header', async ({ page }) => {
  await planByKeyboard(page)
  const tripUrl = page.url()
  await page.goto('/')

  const menu = page.getByRole('button', { name: /^Recent trips/ })
  await tabTo(page, menu)
  await page.keyboard.press('Enter')
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await tabTo(page, page.getByRole('region', { name: 'Recent trips' }).getByRole('link').first())
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(tripUrl)
  await expect(page.getByText(/with the forecast as of then/)).toBeVisible()
})

test('stories 9-11: sign up keeping the trip, save it, re-plan it, share it', async ({ page }) => {
  test.setTimeout(60_000)
  await planByKeyboard(page)

  // 9: sign up from the header; the guest's trip comes along.
  await tabTo(page, page.getByRole('banner').getByRole('link', { name: 'Sign up' }))
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByLabel('Email'))
  await page.keyboard.type(uniqueEmail())
  await page.keyboard.press('Tab')
  await page.keyboard.type('correct-horse-9')
  await page.keyboard.press('Enter')
  await expect(page.getByText('1 trip from this device was added to your account.')).toBeVisible()

  // 10: My trips, open the trip, save it under a name, re-plan it.
  await tabTo(page, page.getByRole('link', { name: 'My trips' }))
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByRole('list', { name: 'Trips' }).getByRole('link').first())
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByRole('button', { name: '☆ Save' }))
  await page.keyboard.press('Enter')
  await page.keyboard.press('Control+A')
  await page.keyboard.type('Weekly run')
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: '★ Saved' })).toBeVisible()
  const savedUrl = page.url()
  await tabTo(page, page.getByRole('button', { name: 'Re-plan with current weather' }), {
    backwards: true,
  })
  await page.keyboard.press('Enter')
  await expect(page).not.toHaveURL(savedUrl)
  await expect(page.getByText(/with the forecast as of then/)).toBeVisible()

  // 11: share it, and turn sharing off again.
  const share = page.getByRole('switch', { name: 'Share' })
  await tabTo(page, share)
  await page.keyboard.press('Space')
  await expect(share).toHaveAttribute('aria-checked', 'true')
  await tabTo(page, page.getByRole('button', { name: 'Copy link' }))
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Link copied|the link is http/)).toBeVisible()
  await tabTo(page, share, { backwards: true })
  await page.keyboard.press('Space')
  await expect(share).toHaveAttribute('aria-checked', 'false')
})

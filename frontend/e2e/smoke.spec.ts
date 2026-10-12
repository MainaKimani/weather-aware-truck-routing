/**
 * The demo trip end to end: plan it, read the ranked routes, open a
 * checkpoint on the map, and scrub the forecast. The backend's fake
 * providers make every run the same.
 */
import { expect, test } from '@playwright/test'

test('plan the demo trip, open a checkpoint and scrub the forecast', async ({ page }) => {
  const api: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/api/')) api.push(pathname)
  })
  const heatmaps = () => api.filter((path) => path.endsWith('/heatmap'))

  await page.goto('/')
  await page.getByRole('button', { name: 'Use the demo trip' }).click()
  await page.getByRole('button', { name: 'Plan trip' }).click()

  // Three ranked routes, the first recommended with its reason.
  const routes = page.getByRole('list', { name: 'Ranked routes' }).getByRole('listitem')
  await expect(routes).toHaveCount(3)
  await expect(routes.first()).toContainText('Route A')
  await expect(routes.first()).toContainText('Recommended')
  await expect(page.getByText('Fewest severe miles')).toBeVisible()
  await expect(page.getByText('Demo data')).toBeVisible()

  // A checkpoint chosen in the table opens its popup on the map (the
  // legend appears once the map has the plan).
  await expect(page.getByRole('region', { name: 'Legend' })).toBeVisible()
  await page.getByRole('row').nth(2).click()
  await expect(page.getByRole('region', { name: /^Checkpoint at mile \d+$/ })).toBeVisible()

  // The heatmap is requested once, after the plan.
  await expect.poll(() => heatmaps().length).toBe(1)

  // Scrubbing changes the hour and the trucks, and calls the API for nothing.
  const callsBefore = api.length
  const slider = page.getByRole('slider', { name: 'Forecast' })
  await slider.focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('status').filter({ hasText: /^\+5 h · / })).toBeVisible()
  await expect(slider).toHaveAttribute('aria-valuetext', /^\+5 hours, \w+day \d\d:00$/)
  await expect(page.getByRole('img', { name: /^Route A truck, at \d+ mi$/ })).toBeVisible()
  await page.keyboard.press('End')
  await expect(page.getByRole('status').filter({ hasText: /^\+48 h · / })).toBeVisible()
  expect(api.slice(callsBefore)).toEqual([])
})

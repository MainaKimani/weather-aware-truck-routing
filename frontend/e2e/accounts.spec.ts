/**
 * The second smoke flow (RFC §17): a guest plans, signs up and keeps the
 * trip, finds it in My trips, shares it, and the link opens for someone
 * else, read-only, until sharing is turned off.
 */
import { expect, test } from '@playwright/test'

import { planDemoTrip, uniqueEmail } from './support'

test('plan as a guest, sign up, find the trip, share it and unshare it', async ({
  page,
  browser,
}) => {
  await page.goto('/')
  await planDemoTrip(page)
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]{36}$/)
  const tripUrl = page.url()
  await expect(page.getByRole('button', { name: /^Recent trips/ })).toContainText('1')

  // Sign up: the guest's trip moves into the account.
  await page.getByRole('banner').getByRole('link', { name: 'Sign up' }).click()
  await page.getByLabel('Email').fill(uniqueEmail())
  await page.getByLabel('Password').fill('correct-horse-9')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByText('1 trip from this device was added to your account.')).toBeVisible()

  // My trips has it.
  await page.getByRole('link', { name: 'My trips' }).click()
  const row = page.getByRole('list', { name: 'Trips' }).getByRole('listitem')
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Dallas, TX → Denver, CO')

  // Share it from its page.
  await row.getByRole('link').click()
  await expect(page).toHaveURL(tripUrl)
  const share = page.getByRole('switch', { name: 'Share' })
  await share.click()
  await expect(share).toHaveAttribute('aria-checked', 'true')

  // Someone else, in a browser of their own, opens the link: read-only.
  const stranger = await browser.newContext()
  const theirs = await stranger.newPage()
  await theirs.goto(tripUrl)
  await expect(theirs.getByText(/Shared with you, read-only/)).toBeVisible()
  await expect(
    theirs.getByRole('list', { name: 'Ranked routes' }).getByRole('listitem'),
  ).toHaveCount(3)
  await expect(theirs.getByRole('button', { name: 'Edit trip' })).toHaveCount(0)

  // Sharing off: the same link no longer opens it for them.
  await share.click()
  await expect(share).toHaveAttribute('aria-checked', 'false')
  await theirs.reload()
  await expect(theirs.getByRole('heading', { name: 'Trip not found' })).toBeVisible()
  await stranger.close()
})

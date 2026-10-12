/** Helpers shared by the end-to-end specs. */
import { AxeBuilder } from '@axe-core/playwright'
import { expect, type Locator, type Page } from '@playwright/test'

import type { Plan } from '../src/api/schema'

/** WCAG 2.2 A and AA, plus axe's best practices. */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

/**
 * Runs axe on the page as it is and fails on any serious or critical
 * violation, listing each with the elements it was found on.
 */
export async function expectAccessible(page: Page, state: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()
  const blocking = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map(
      (v) => `${v.id} (${String(v.impact)}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    )
  expect(blocking, `serious or critical axe violations: ${state}`).toEqual([])
}

/**
 * Presses Tab (or Shift+Tab) until `target` has focus, the way a keyboard
 * user gets there, and fails if it isn't reached within `limit` presses.
 *
 * The target may not be on the page yet: the checkpoint table renders only
 * the rows near what's in view, so a row further down appears as focus moves
 * towards it. It is counted first, which doesn't wait, because asking an
 * absent element whether it has focus waits for it to appear.
 */
export async function tabTo(
  page: Page,
  target: Locator,
  { limit = 80, backwards = false }: { limit?: number; backwards?: boolean } = {},
): Promise<void> {
  const key = backwards ? 'Shift+Tab' : 'Tab'
  for (let i = 0; i < limit; i++) {
    // A short wait: the element can be replaced between the count and the check.
    const focused =
      (await target.count()) > 0 &&
      (await target.evaluate(isFocused, undefined, { timeout: 1000 }).catch(() => false))
    if (focused) return
    await page.keyboard.press(key)
  }
  throw new Error(`${key} never reached ${target.toString()} in ${String(limit)} presses`)
}

function isFocused(element: Element): boolean {
  return element === document.activeElement
}

/**
 * Answers plan requests with `plan`, as the backend would, and its trip's
 * page with the same plan saved: planning opens that page, and the real
 * backend never saw this trip.
 */
export async function respondToPlanWith(page: Page, plan: Plan): Promise<void> {
  const saved = {
    ...plan,
    name: '',
    saved: false,
    shared: false,
    created_at: plan.generated_at,
    is_owner: true,
    replanned_from: null,
  }
  await page.route('**/api/v1/plans', (route) => route.fulfill({ json: plan }))
  await page.route(`**/api/v1/trips/${plan.trip_id}`, (route) => route.fulfill({ json: saved }))
}

export async function planDemoTrip(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Use the demo trip' }).click()
  await page.getByRole('button', { name: 'Plan trip' }).click()
  await expect(page.getByRole('list', { name: 'Ranked routes' }).getByRole('listitem')).toHaveCount(
    3,
  )
  // The legend shows once the map has drawn the plan.
  await expect(page.getByRole('region', { name: 'Legend' })).toBeVisible()
}

/** A fresh address per run: sign-ups go to a database that outlives the test. */
export function uniqueEmail(): string {
  return `e2e-${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}@example.com`
}

/** Signs up a new user from wherever the page is; returns the email. */
export async function signUp(page: Page): Promise<string> {
  const email = uniqueEmail()
  await page.goto('/signup')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('correct-horse-9')
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page.getByRole('link', { name: 'My trips' })).toBeVisible()
  return email
}

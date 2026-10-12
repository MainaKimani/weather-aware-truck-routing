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
 * Presses Tab until `target` has focus, the way a keyboard user gets there,
 * and fails if it isn't reached within `limit` presses.
 */
export async function tabTo(page: Page, target: Locator, limit = 80): Promise<void> {
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab never reached ${target.toString()} in ${String(limit)} presses`)
}

/** Answers the next plan request with `plan`, as the backend would. */
export async function respondToPlanWith(page: Page, plan: Plan): Promise<void> {
  await page.route('**/api/v1/plans', (route) => route.fulfill({ json: plan }))
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

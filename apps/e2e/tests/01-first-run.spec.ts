import { test, expect } from '@playwright/test'
import { resetDatabase, TEST_OWNER } from '../fixtures/helpers'

/**
 * US-18: First Run wizard creates Owner and redirects to Dashboard.
 * Second access to /admin/setup redirects to login.
 */
test.describe('First Run Wizard', () => {
  test.beforeAll(async ({ request }) => {
    await resetDatabase(request)
  })

  test('navigating to /admin redirects to /admin/setup when no owner exists', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/setup/)
  })

  test('setup wizard: complete all 4 steps and create owner', async ({ page }) => {
    await page.goto('/admin/setup')

    // Step 1: Owner Account (subtitle is unique; "Owner Account" also appears in progress rail)
    await expect(page.getByText(/Step 1 of 4 — Owner Account/)).toBeVisible()
    await page.fill('[name="ownerName"], input[placeholder*="name" i], #ownerName', TEST_OWNER.name)
    await page.fill('[name="ownerEmail"], input[type="email"], #ownerEmail', TEST_OWNER.email)
    await page.fill('[name="ownerPassword"], input[type="password"]', TEST_OWNER.password)
    // Confirm password field (second password input)
    const passwordInputs = page.locator('input[type="password"]')
    await passwordInputs.nth(1).fill(TEST_OWNER.password)
    await page.getByRole('button', { name: /next|continue/i }).click()

    // Step 2: Database (avoid strict mode: body text also contains "database")
    await expect(page.getByText(/Step 2 of 4 — Database/)).toBeVisible()
    await page.getByRole('button', { name: /next|continue/i }).click()

    // Step 3: Email (SMTP) - skip optional SMTP config
    await expect(page.getByText(/Step 3 of 4 — Email \(SMTP\)/)).toBeVisible()
    await page.getByRole('button', { name: /next|continue/i }).click()

    // Step 4: Blog Identity
    await expect(page.getByText(/Step 4 of 4 — Blog Identity/i)).toBeVisible()
    // Avoid placeholder*="blog" — it matches the URL field ("my**blog**.com").
    await page.locator('[name="blogName"]').fill('E2E Test Blog')
    await page.locator('[name="blogUrl"]').fill('http://localhost:3900')

    // Submit the form
    await page.getByRole('button', { name: /complete setup|finish|submit/i }).click()

    // Should redirect to login with ?setup=complete
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15_000 })
    await expect(page.getByText(/setup complete/i)).toBeVisible()
  })

  test('second access to /admin/setup redirects to login', async ({ page }) => {
    await page.goto('/admin/setup')
    // Should be redirected away from setup (owner already exists)
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 10_000 })
  })

  test('owner can log in after setup', async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('#email', TEST_OWNER.email)
    await page.fill('#password', TEST_OWNER.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/admin\/(dashboard|interests)/, { timeout: 10_000 })
  })
})

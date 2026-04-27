import { test, expect } from '@playwright/test'
import {
  resetDatabase,
  setupOwnerViaApi,
  loginViaApi,
  getEmailToken,
  setLocalStorageAuth,
  TEST_OWNER,
  TEST_USER,
} from '../fixtures/helpers'

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3901'

/**
 * US-18: User registers, confirms email, waits for approval, gets approved, logs in.
 */
test.describe('User Registration, Email Confirmation, and Admin Approval', () => {
  test.beforeAll(async ({ request }) => {
    await resetDatabase(request)
    await setupOwnerViaApi(request)
  })

  test('user can navigate to registration page', async ({ page }) => {
    await page.goto('/admin/register')
    await expect(page.getByRole('heading', { name: /register|create account|sign up/i })).toBeVisible()
  })

  test('user registers and sees confirmation message', async ({ page }) => {
    await page.goto('/admin/register')

    await page.fill('input[name="name"], #name, input[placeholder*="name" i]', TEST_USER.name)

    const nicknameInput = page.locator(
      'input[name="nickname"], #nickname, input[placeholder*="nickname" i]'
    )
    if (await nicknameInput.count() > 0) {
      await nicknameInput.fill(TEST_USER.nickname)
    }

    await page.fill('input[type="email"], #email', TEST_USER.email)
    await page.fill('input[type="password"], #password', TEST_USER.password)

    await page.click('button[type="submit"]')

    // Should show success/pending message
    await expect(
      page.getByText(/confirm.*email|check.*email|confirmation.*sent/i)
    ).toBeVisible({ timeout: 10_000 })
  })

  test('user confirms email via token', async ({ request, page }) => {
    const token = await getEmailToken(request, TEST_USER.email)

    await page.goto(`/admin/confirm-email?token=${token}`)

    // Should show confirmed or pending approval message
    await expect(
      page.getByText(/confirmed|pending.*approval|awaiting.*approval/i)
    ).toBeVisible({ timeout: 10_000 })
  })

  test('owner can see user in pending approval list', async ({ request, page }) => {
    // Login as owner
    const accessToken = await loginViaApi(request, TEST_OWNER.email, TEST_OWNER.password)

    // Get owner user info
    const meRes = await request.get(`${ADMIN_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(meRes.ok()).toBeTruthy()
    const { users } = await meRes.json()
    const owner = users.find((u: { role: string }) => u.role === 'owner')
    expect(owner).toBeDefined()

    // Navigate to admin users page
    await page.goto('/admin/login')
    await page.fill('#email', TEST_OWNER.email)
    await page.fill('#password', TEST_OWNER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin\/(dashboard|interests)/, { timeout: 10_000 })

    // Navigate to users page
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // Should see the pending user
    await expect(page.getByText(TEST_USER.email)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Awaiting Approval', { exact: true })).toBeVisible()
  })

  test('owner approves the user via API', async ({ request }) => {
    const accessToken = await loginViaApi(request, TEST_OWNER.email, TEST_OWNER.password)

    // Get users list to find the pending user ID
    const usersRes = await request.get(`${ADMIN_URL}/api/admin/users?status=pending_approval`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(usersRes.ok()).toBeTruthy()
    const { users } = await usersRes.json()
    const pendingUser = users.find((u: { email: string }) => u.email === TEST_USER.email)
    expect(pendingUser).toBeDefined()

    // Approve the user
    const approveRes = await request.post(
      `${ADMIN_URL}/api/admin/users/${pendingUser.id}/approve`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    expect(approveRes.ok()).toBeTruthy()
    const approveData = await approveRes.json()
    expect(approveData.user?.status ?? approveData.status ?? 'active').toBe('active')
  })

  test('approved user can log in and access dashboard', async ({ page }) => {
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('#email')).toBeVisible({ timeout: 10_000 })
    await page.fill('#email', TEST_USER.email)
    await page.fill('#password', TEST_USER.password)
    await page.click('button[type="submit"]')

    // First login may land on interests (first_login_done) or dashboard
    await page.waitForURL(/\/admin\/(dashboard|interests)/, { timeout: 20_000 })
  })

  test('login is blocked for unconfirmed user', async ({ request, page }) => {
    // Register another user without confirming email
    await request.post(`${ADMIN_URL}/api/auth/register`, {
      data: {
        name: 'Unconfirmed User',
        email: 'unconfirmed@e2e.test',
        password: 'UnconfirmedPass123!',
      },
    })

    // Try to login
    await page.goto('/admin/login')
    await page.fill('#email', 'unconfirmed@e2e.test')
    await page.fill('#password', 'UnconfirmedPass123!')
    await page.click('button[type="submit"]')

    // Should show error about unconfirmed email
    await expect(
      page.getByText(/email.*confirm|confirm.*email|pending.*email|not.*confirmed/i)
    ).toBeVisible({ timeout: 5_000 })
  })
})

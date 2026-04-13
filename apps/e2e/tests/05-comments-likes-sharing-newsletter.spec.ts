import { test, expect } from '@playwright/test'
import {
  resetDatabase,
  setupOwnerViaApi,
  loginViaApi,
  loginViaUI,
  createPostViaApi,
  getNewsletterToken,
  TEST_OWNER,
} from '../fixtures/helpers'
import { ADMIN_URL, BLOG_URL } from '../playwright.config'

/**
 * US-27: E2E tests — comments, likes, sharing, and newsletter flows.
 */
test.describe('Comments, Likes, Sharing, and Newsletter', () => {
  let ownerToken: string
  let postSlug: string

  test.beforeAll(async ({ request }) => {
    await resetDatabase(request)
    await setupOwnerViaApi(request)
    ownerToken = await loginViaApi(request, TEST_OWNER.email, TEST_OWNER.password)

    const post = await createPostViaApi(request, ownerToken, {
      title: 'Test Engagement Post',
      content: 'This is a public post for testing engagement features.',
      visibility: 'public',
      status: 'published',
    })
    postSlug = post.slug
  })

  // ── Comment System ──────────────────────────────────────────────────────────

  test('anonymous visitor sees login prompt in comment section', async ({ page }) => {
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // The comment section login banner should be visible
    await expect(
      page.getByText(/log in|login|create an account/i)
    ).toBeVisible({ timeout: 10_000 })

    // No comment form should be shown to anonymous users
    await expect(page.locator('textarea[id="comment-content"]')).not.toBeVisible()
  })

  test('logged-in user can post a comment and it appears', async ({ page }) => {
    // Login via admin UI to set the refreshToken cookie on localhost:3901
    await loginViaUI(page, TEST_OWNER.email, TEST_OWNER.password)

    // Navigate to the blog post
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // Wait for comment form to appear (session detected)
    const textarea = page.locator('textarea[id="comment-content"]')
    await expect(textarea).toBeVisible({ timeout: 15_000 })

    // Type a comment
    await textarea.fill('Great article! Really enjoyed reading it.')

    // Submit the comment
    await page.getByRole('button', { name: /post comment/i }).click()

    // Comment should appear in the list
    await expect(
      page.getByText('Great article! Really enjoyed reading it.')
    ).toBeVisible({ timeout: 10_000 })
  })

  test('logged-in user can upvote a comment and count increments', async ({ page }) => {
    // Login and navigate (session already established by previous test in same context,
    // but each test gets a new page — so we login again)
    await loginViaUI(page, TEST_OWNER.email, TEST_OWNER.password)
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // Wait for comments to load and the upvote button to appear
    const upvoteBtn = page.locator('[aria-label*="Upvote"]').first()
    await expect(upvoteBtn).toBeVisible({ timeout: 15_000 })

    // Read the initial count
    const initialCountText = await upvoteBtn.locator('span').textContent()
    const initialCount = parseInt(initialCountText ?? '0', 10)

    // Click upvote
    await upvoteBtn.click()

    // Count should increment
    await expect(upvoteBtn.locator('span')).toHaveText(String(initialCount + 1), {
      timeout: 5_000,
    })

    // Button should be in pressed state
    await expect(upvoteBtn).toHaveAttribute('aria-pressed', 'true')
  })

  // ── Newsletter ──────────────────────────────────────────────────────────────

  test('newsletter subscribe form shows "Verifique seu e-mail!" after submission', async ({ page }) => {
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    const emailInput = page.locator('#newsletter-email')
    await expect(emailInput).toBeVisible({ timeout: 10_000 })

    await emailInput.fill('newsletter-test@e2e.test')

    // Check the privacy checkbox
    const checkbox = page.locator('.privacyLabel input[type="checkbox"], label input[type="checkbox"]').first()
    await checkbox.check()

    // Submit
    await page.getByRole('button', { name: /inscrever-se|subscribe/i }).click()

    // Success message should appear
    await expect(
      page.getByText(/verifique seu e-mail|check your email/i)
    ).toBeVisible({ timeout: 10_000 })
  })

  test('newsletter confirmation link shows "Inscrição confirmada!"', async ({ page, request }) => {
    // Get the confirmation token from the test endpoint
    const token = await getNewsletterToken(request, 'newsletter-test@e2e.test')

    // Navigate to the confirmation URL on the blog
    await page.goto(`${BLOG_URL}/newsletter/confirm?token=${encodeURIComponent(token)}`)
    await page.waitForLoadState('networkidle')

    // Should show subscription confirmed message
    await expect(
      page.getByText(/inscrição confirmada|subscription confirmed/i)
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── Post Likes ──────────────────────────────────────────────────────────────

  test('logged-in user can like a post and the heart fills', async ({ page }) => {
    await loginViaUI(page, TEST_OWNER.email, TEST_OWNER.password)
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // Find the like button (aria-label contains "Like")
    const likeBtn = page.locator('[aria-label*="Like"]').first()
    await expect(likeBtn).toBeVisible({ timeout: 15_000 })

    // Initially not liked
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'false')

    // Click the like button
    await likeBtn.click()

    // Should be liked now (aria-pressed=true)
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 })
  })

  test('anonymous user sees "Login to like" tooltip on like button click', async ({ page }) => {
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // Find the like button
    const likeBtn = page.locator('[aria-label*="Like"]').first()
    await expect(likeBtn).toBeVisible({ timeout: 10_000 })

    // Click as anonymous user — should show tooltip
    await likeBtn.click()

    await expect(
      page.getByRole('tooltip').filter({ hasText: /login to like/i })
    ).toBeVisible({ timeout: 5_000 })
  })

  // ── Share Dropdown ──────────────────────────────────────────────────────────

  test('share dropdown opens on button click', async ({ page }) => {
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // Find the share button
    const shareBtn = page.locator('[aria-label*="ompartilhar"], [aria-label*="hare"]').first()
    await expect(shareBtn).toBeVisible({ timeout: 10_000 })

    // Click to open dropdown
    await shareBtn.click()

    // Dropdown menu should appear
    await expect(page.getByRole('menu')).toBeVisible({ timeout: 5_000 })

    // Should have copy link option
    await expect(
      page.getByRole('menuitem', { name: /copiar link|copy link/i })
    ).toBeVisible()
  })

  test('copy-link shows tooltip after click', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // Open share dropdown
    const shareBtn = page.locator('[aria-label*="ompartilhar"], [aria-label*="hare"]').first()
    await expect(shareBtn).toBeVisible({ timeout: 10_000 })
    await shareBtn.click()

    // Click copy link
    await page.getByRole('menuitem', { name: /copiar link|copy link/i }).click()

    // Tooltip should appear with confirmation message
    await expect(
      page.getByText(/link copiado|link copied/i)
    ).toBeVisible({ timeout: 5_000 })
  })
})

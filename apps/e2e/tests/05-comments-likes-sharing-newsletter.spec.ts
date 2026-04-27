import { test, expect, type Page } from '@playwright/test'
import {
  resetDatabase,
  setupOwnerViaApi,
  loginViaApi,
  openBlogWithAuth,
  createPostViaApi,
  getNewsletterToken,
  TEST_OWNER,
} from '../fixtures/helpers'
import { BLOG_URL } from '../playwright.config'

/** Tokens from logged-in tests persist in the same browser context; clear before anonymous flows. */
async function resetBlogAnonymousSession(page: Page) {
  await page.goto(BLOG_URL, { waitUntil: 'load' })
  await page.evaluate(() => {
    window.localStorage.removeItem('accessToken')
    window.localStorage.removeItem('currentUser')
  })
}

/**
 * US-27: E2E tests — comments, likes, sharing, and newsletter flows.
 */
test.describe('Comments, Likes, Sharing, and Newsletter', () => {
  let ownerToken: string
  let postSlug: string

  /** Main post article (excludes related-post cards that also include share controls). */
  const mainPostArticle = (page: Page) => page.locator('main article').first()

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
    await page.waitForLoadState('load')

    // Two separate links match the regex; assert at least one prompt link
    await expect(page.getByRole('link', { name: /log in/i })).toBeVisible({ timeout: 10_000 })

    // No comment form should be shown to anonymous users
    await expect(page.locator('textarea[id="comment-content"]')).not.toBeVisible()
  })

  test('logged-in user can post a comment and it appears', async ({ page, request }) => {
    await openBlogWithAuth(page, request, TEST_OWNER.email, TEST_OWNER.password, `${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('load')

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

  test('logged-in user can upvote a comment and count increments', async ({ page, request }) => {
    await openBlogWithAuth(page, request, TEST_OWNER.email, TEST_OWNER.password, `${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('load')

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
    await page.waitForLoadState('load')

    const emailInput = page.locator('#newsletter-email')
    await expect(emailInput).toBeVisible({ timeout: 10_000 })

    await emailInput.fill('newsletter-test@e2e.test')

    await page.locator('#newsletter-privacy').check()

    // Submit (scope to this card — avoids strict mode if other checkboxes exist on the page)
    await page
      .getByRole('heading', { name: /Receba novos artigos/i })
      .locator('..')
      .getByRole('button', { name: /inscrever-se|subscribe/i })
      .click()

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
    await page.waitForLoadState('load')

    // Should show subscription confirmed message
    await expect(
      page.getByText(/inscrição confirmada|subscription confirmed/i)
    ).toBeVisible({ timeout: 10_000 })
  })

  // ── Post Likes ──────────────────────────────────────────────────────────────

  test('logged-in user can like a post and the heart fills', async ({ page, request }) => {
    await openBlogWithAuth(page, request, TEST_OWNER.email, TEST_OWNER.password, `${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('load')

    const likeBtn = mainPostArticle(page).getByRole('button', { name: /like|curtir/i })
    await expect(likeBtn).toBeVisible({ timeout: 15_000 })

    // Initially not liked
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'false')

    // Click the like button
    await likeBtn.click()

    // Should be liked now (aria-pressed=true)
    await expect(likeBtn).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 })
  })

  test('anonymous user sees "Login to like" tooltip on like button click', async ({ page }) => {
    await resetBlogAnonymousSession(page)
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('load')

    const likeBtn = mainPostArticle(page).getByRole('button', { name: /like|curtir/i })
    await expect(likeBtn).toBeVisible({ timeout: 10_000 })

    // Click as anonymous user — should show tooltip
    await likeBtn.click()

    await expect(
      page.locator('[role="tooltip"]').filter({ hasText: /login to like/i })
    ).toBeVisible({ timeout: 5_000 })
  })

  // ── Share Dropdown ──────────────────────────────────────────────────────────

  test('share dropdown opens on button click', async ({ page }) => {
    await resetBlogAnonymousSession(page)
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('load')

    const shareBtn = mainPostArticle(page).getByRole('button', { name: /compartilhar|share/i })
    await expect(shareBtn).toBeVisible({ timeout: 10_000 })
    await shareBtn.click({ force: true })
    await expect(shareBtn).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 })

    await expect(mainPostArticle(page).locator('[role="menu"]')).toBeVisible({ timeout: 5_000 })

    // Should have copy link option
    await expect(
      mainPostArticle(page).getByRole('menuitem', { name: /copiar link|copy link/i })
    ).toBeVisible()
  })

  test('copy-link shows tooltip after click', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])

    await resetBlogAnonymousSession(page)
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('load')

    const shareBtn = mainPostArticle(page).getByRole('button', { name: /compartilhar|share/i })
    await expect(shareBtn).toBeVisible({ timeout: 10_000 })
    await shareBtn.click({ force: true })
    await expect(shareBtn).toHaveAttribute('aria-expanded', 'true', { timeout: 5_000 })
    await expect(mainPostArticle(page).locator('[role="menu"]')).toBeVisible({ timeout: 5_000 })

    // Click copy link
    await mainPostArticle(page).getByRole('menuitem', { name: /copiar link|copy link/i }).click()

    // Tooltip should appear with confirmation message
    await expect(
      page.getByText(/link copiado|link copied/i)
    ).toBeVisible({ timeout: 5_000 })
  })
})

import { test, expect } from '@playwright/test'
import {
  resetDatabase,
  setupOwnerViaApi,
  loginViaApi,
  createPostViaApi,
  TEST_OWNER,
} from '../fixtures/helpers'

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3901'
const BLOG_URL = process.env.BLOG_URL ?? 'http://localhost:3900'

/**
 * US-18: Post with visibility=allPrivate not visible to anonymous visitor
 * but visible to logged-in approved user via admin.
 */
test.describe('Post Visibility — allPrivate', () => {
  let ownerToken: string
  let postSlug: string
  let postId: string

  test.beforeAll(async ({ request }) => {
    await resetDatabase(request)
    await setupOwnerViaApi(request)
    ownerToken = await loginViaApi(request, TEST_OWNER.email, TEST_OWNER.password)

    // Create a post with allPrivate visibility
    const post = await createPostViaApi(request, ownerToken, {
      title: 'Members Only Article',
      content: 'This is restricted content for members only.',
      visibility: 'allPrivate',
      status: 'published',
    })
    postSlug = post.slug
    postId = post.id
  })

  test('public v1 API returns 404 for allPrivate post', async ({ request }) => {
    const res = await request.get(`${ADMIN_URL}/api/v1/posts/${postSlug}`)
    expect(res.status()).toBe(404)
  })

  test('blog page shows RBACBanner for allPrivate post (anonymous visitor)', async ({ page }) => {
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // RBAC banner heading (title "Members Only Article" also matches broad regex)
    await expect(page.getByRole('heading', { name: /members-only content/i })).toBeVisible({
      timeout: 10_000,
    })

    // Should NOT show the full article content
    await expect(
      page.getByText(/This is restricted content for members only/)
    ).not.toBeVisible()
  })

  test('blog page shows blur overlay for allPrivate post', async ({ page }) => {
    await page.goto(`${BLOG_URL}/blog/${postSlug}`)
    await page.waitForLoadState('networkidle')

    // The RBACBanner should be present in the DOM
    const banner = page.locator('[class*="banner"], [class*="rbac"], [class*="restrict"]').first()
    await expect(banner).toBeVisible({ timeout: 10_000 })
  })

  test('authenticated admin can see allPrivate post in admin panel', async ({ request }) => {
    // Admin API (internal) can access allPrivate posts via their UUID
    const res = await request.get(`${ADMIN_URL}/api/posts/${postId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    // Admin endpoint should be able to access it (not 404)
    expect(res.status()).not.toBe(404)
    const data = await res.json()
    expect(data.post?.visibility ?? data.visibility).toBe('allPrivate')
  })

  test('public API v1 does not list allPrivate posts', async ({ request }) => {
    const res = await request.get(`${ADMIN_URL}/api/v1/posts`)
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    const privatePosts = (data.data as Array<{ visibility: string }>).filter(
      (p) => p.visibility !== 'public'
    )
    expect(privatePosts).toHaveLength(0)
  })
})

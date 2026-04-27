import { test, expect } from '@playwright/test'
import { resetDatabase, setupOwnerViaApi } from '../fixtures/helpers'

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3901'
const BLOG_URL = process.env.BLOG_URL ?? 'http://localhost:3900'

test.describe('Setup seed posts', () => {
  test('initial setup seeds 10 published public posts for the blog feed', async ({ request, page }) => {
    await resetDatabase(request)
    await setupOwnerViaApi(request)

    const res = await request.get(`${ADMIN_URL}/api/blog/posts?limit=20&page=1`)
    expect(res.ok()).toBeTruthy()

    const data = (await res.json()) as {
      posts: Array<{ title: string; slug: string; status: string; visibility: string }>
      total: number
    }

    expect(data.total).toBe(10)
    expect(data.posts).toHaveLength(10)
    expect(data.posts[0]).toMatchObject({
      title: 'Post de exemplo 01',
      slug: 'post-de-exemplo-01',
      status: 'published',
      visibility: 'public',
    })
    expect(data.posts.every((post) => post.status === 'published')).toBeTruthy()
    expect(data.posts.every((post) => post.visibility === 'public')).toBeTruthy()

    await page.goto(`${BLOG_URL}/blog`)
    await expect(
      page.getByRole('heading', { name: /todos os artigos — e2e test blog/i })
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Post de exemplo 01' })).toBeVisible()
    await expect(page.getByText(/Mostrando 1–10 de 10 artigos/i)).toBeVisible()
  })
})

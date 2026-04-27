import { Page, APIRequestContext } from '@playwright/test'

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3901'

// ── Test DB helpers ──────────────────────────────────────────────────────────

export async function resetDatabase(request: APIRequestContext) {
  const res = await request.post(`${ADMIN_URL}/api/test/reset`)
  if (!res.ok()) {
    throw new Error(`Failed to reset database: ${await res.text()}`)
  }
}

export async function getEmailToken(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const res = await request.get(
    `${ADMIN_URL}/api/test/email-token?email=${encodeURIComponent(email)}`
  )
  if (!res.ok()) {
    throw new Error(`Failed to get email token for ${email}: ${await res.text()}`)
  }
  const data = await res.json()
  if (!data.email_token) {
    throw new Error(`No email token found for ${email} (status: ${data.status})`)
  }
  return data.email_token as string
}

export async function getNewsletterToken(
  request: APIRequestContext,
  email: string
): Promise<string> {
  const res = await request.get(
    `${ADMIN_URL}/api/test/newsletter-token?email=${encodeURIComponent(email)}`
  )
  if (!res.ok()) {
    throw new Error(`Failed to get newsletter token for ${email}: ${await res.text()}`)
  }
  const data = await res.json()
  if (!data.token) {
    throw new Error(`No newsletter token found for ${email} (status: ${data.status})`)
  }
  return data.token as string
}

// ── Setup helpers ────────────────────────────────────────────────────────────

export const TEST_OWNER = {
  name: 'E2E Owner',
  email: 'owner@e2e.test',
  password: 'E2eTestPass123!',
}

export const TEST_USER = {
  name: 'E2E User',
  nickname: 'e2euser',
  email: 'user@e2e.test',
  password: 'E2eUserPass123!',
}

export async function setupOwnerViaApi(request: APIRequestContext) {
  const res = await request.post(`${ADMIN_URL}/api/setup/complete`, {
    data: {
      ownerName: TEST_OWNER.name,
      ownerEmail: TEST_OWNER.email,
      ownerPassword: TEST_OWNER.password,
      dbType: 'sqlite',
      blogName: 'E2E Test Blog',
      blogDescription: 'Blog for E2E testing',
      blogUrl: 'http://localhost:3900',
    },
  })
  if (!res.ok()) {
    throw new Error(`Failed to setup owner: ${await res.text()}`)
  }
  return res.json()
}

export async function loginViaApi(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post(`${ADMIN_URL}/api/auth/login`, {
    data: { email, password },
  })
  if (!res.ok()) {
    const text = await res.text()
    throw new Error(`Login failed for ${email}: ${text}`)
  }
  const data = await res.json()
  return data.accessToken as string
}

export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
  options?: { blogBaseUrl?: string }
) {
  await page.goto('/admin/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  await page.waitForURL(/\/admin\/(dashboard|interests)/, { timeout: 10_000 })

  // Copy admin tokens to blog origin so fetchAdminSession() works cross-port (SameSite cookies are not sent).
  if (options?.blogBaseUrl) {
    const creds = await page.evaluate(() => ({
      token: localStorage.getItem('accessToken'),
      user: localStorage.getItem('currentUser') ?? '{}',
    }))
    if (!creds.token) {
      throw new Error('loginViaUI: accessToken missing after login')
    }
    await page.goto(options.blogBaseUrl, { waitUntil: 'load' })
    await page.evaluate(
      ([t, u]) => {
        window.localStorage.setItem('accessToken', t)
        window.localStorage.setItem('currentUser', u)
      },
      [creds.token, creds.user] as [string, string]
    )
    await page.reload({ waitUntil: 'load' })
  }
}

export async function setLocalStorageAuth(page: Page, accessToken: string, user: object) {
  await page.evaluate(
    ([token, userData]: [string, string]) => {
      window.localStorage.setItem('accessToken', token)
      window.localStorage.setItem('currentUser', userData)
    },
    [accessToken, JSON.stringify(user)] as [string, string]
  )
}

/**
 * Open a blog URL with accessToken + currentUser already in localStorage before any client JS runs.
 * Uses API login + /api/auth/me (same payload shape as admin UI login).
 */
export async function openBlogWithAuth(
  page: Page,
  request: APIRequestContext,
  email: string,
  password: string,
  blogPageUrl: string
) {
  const token = await loginViaApi(request, email, password)
  const meRes = await request.get(`${ADMIN_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!meRes.ok()) {
    throw new Error(`openBlogWithAuth: /api/auth/me failed: ${await meRes.text()}`)
  }
  const { user } = (await meRes.json()) as { user: object }
  const userJson = JSON.stringify(user)

  await page.goto(blogPageUrl, { waitUntil: 'load' })
  await page.evaluate(
    ([t, u]) => {
      window.localStorage.setItem('accessToken', t)
      window.localStorage.setItem('currentUser', u)
    },
    [token, userJson] as [string, string]
  )
  await page.reload({ waitUntil: 'load' })
}

// ── Post creation helper ─────────────────────────────────────────────────────

export async function createPostViaApi(
  request: APIRequestContext,
  accessToken: string,
  postData: {
    title: string
    content: string
    visibility: string
    status: string
  }
): Promise<{ id: string; slug: string }> {
  const res = await request.post(`${ADMIN_URL}/api/posts`, {
    data: postData,
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok()) {
    throw new Error(`Failed to create post: ${await res.text()}`)
  }
  const body = await res.json() as { post?: { id: string; slug: string }; id?: string; slug?: string }
  // POST /api/posts returns { post: { id, slug } }
  return (body.post ?? { id: body.id!, slug: body.slug! })
}

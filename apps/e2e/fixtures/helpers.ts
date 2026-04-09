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
  password: string
) {
  await page.goto('/admin/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  // Store token in localStorage (mimics what the login form does)
  // The login form navigates to dashboard on success
  await page.waitForURL(/\/admin\/(dashboard|interests)/, { timeout: 10_000 })
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

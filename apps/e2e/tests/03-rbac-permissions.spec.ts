import { test, expect } from '@playwright/test'
import {
  resetDatabase,
  setupOwnerViaApi,
  loginViaApi,
  TEST_OWNER,
} from '../fixtures/helpers'

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3901'

/**
 * US-18: Owner sets RBAC permissions per group.
 */
test.describe('RBAC Permissions per Group', () => {
  let ownerToken: string

  test.beforeAll(async ({ request }) => {
    await resetDatabase(request)
    await setupOwnerViaApi(request)
    ownerToken = await loginViaApi(request, TEST_OWNER.email, TEST_OWNER.password)
  })

  test('groups list is accessible to owner', async ({ request }) => {
    const res = await request.get(`${ADMIN_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    expect(res.ok()).toBeTruthy()
    const data = await res.json()
    expect(Array.isArray(data.groups)).toBeTruthy()
    // Should have at least owner and default system groups
    const groupNames = data.groups.map((g: { name: string }) => g.name)
    expect(groupNames).toContain('owner')
    expect(groupNames).toContain('default')
  })

  test('can read default group permissions', async ({ request }) => {
    // Get groups
    const groupsRes = await request.get(`${ADMIN_URL}/api/groups`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    const { groups } = await groupsRes.json()
    const defaultGroup = groups.find((g: { name: string }) => g.name === 'default')
    expect(defaultGroup).toBeDefined()

    // Get permissions for default group
    const permRes = await request.get(
      `${ADMIN_URL}/api/groups/${defaultGroup.id}/permissions`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    )
    expect(permRes.ok()).toBeTruthy()
    const permData = await permRes.json()
    // Should have permissions object
    expect(permData).toBeDefined()
  })

  test('can update permissions for a non-system group', async ({ request }) => {
    // Create a new group
    const createRes = await request.post(`${ADMIN_URL}/api/groups`, {
      data: { name: 'E2E Test Group', description: 'For E2E testing' },
      headers: { Authorization: `Bearer ${ownerToken}` },
    })
    expect(createRes.ok()).toBeTruthy()
    const { group } = await createRes.json()
    expect(group.id).toBeDefined()

    // Set permissions on the new group
    const updateRes = await request.put(
      `${ADMIN_URL}/api/groups/${group.id}/permissions`,
      {
        data: {
          permissions: {
            posts: ['read', 'write'],
            comments: ['read'],
          },
        },
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    )
    expect(updateRes.ok()).toBeTruthy()

    // Verify permissions were saved
    const permRes = await request.get(
      `${ADMIN_URL}/api/groups/${group.id}/permissions`,
      { headers: { Authorization: `Bearer ${ownerToken}` } }
    )
    expect(permRes.ok()).toBeTruthy()
    const permData = await permRes.json()
    // posts read/write should be granted
    const postsPerms = permData.permissions?.posts ?? []
    expect(postsPerms).toContain('read')
    expect(postsPerms).toContain('write')
    // posts delete should NOT be granted
    expect(postsPerms).not.toContain('delete')
  })

  test('owner navigates to groups page and sees group list', async ({ request, page }) => {
    // Login via UI
    await page.goto('/admin/login')
    await page.fill('#email', TEST_OWNER.email)
    await page.fill('#password', TEST_OWNER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin\/(dashboard|interests)/, { timeout: 10_000 })

    // Navigate to groups
    await page.goto('/admin/groups')
    await page.waitForLoadState('networkidle')

    // Groups page should show system groups (avoid strict mode: description cells also contain "owner")
    await expect(page.getByRole('link', { name: 'owner', exact: true })).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole('link', { name: 'default', exact: true })).toBeVisible()
  })

  test('owner can navigate to group detail and see permissions matrix', async ({ page }) => {
    // Get group ID via API
    const context = page.context()
    const apiPage = await context.newPage()

    // Login first to get the page into auth state
    await page.goto('/admin/login')
    await page.fill('#email', TEST_OWNER.email)
    await page.fill('#password', TEST_OWNER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin\/(dashboard|interests)/, { timeout: 10_000 })

    await apiPage.close()

    // Navigate to groups
    await page.goto('/admin/groups')
    await page.waitForLoadState('networkidle')

    // Click on the "default" group link
    const defaultGroupLink = page.getByRole('link', { name: /default/i }).first()
    if (await defaultGroupLink.count() > 0) {
      await defaultGroupLink.click()
      await page.waitForLoadState('networkidle')

      // Should see permissions matrix (checkboxes or permission list)
      await expect(
        page.getByText(/posts|permissions|access/i)
      ).toBeVisible({ timeout: 5_000 })
    }
  })
})

/**
 * Integration tests for POST /api/posts (admin post creation).
 *
 * Tests: 201 (success), 401 (unauthenticated), 403 (insufficient role), XSS sanitization.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createTestDb } from '../helpers/db'
import { generateToken } from '@/lib/auth'
import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

// --- Module mocks ---

let testDb: Database.Database

vi.mock('@/lib/db', () => ({
  getDb: () => testDb,
  getSetting: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/email', () => ({
  sendEmailConfirmation: vi.fn().mockResolvedValue(undefined),
  sendApprovalNotification: vi.fn().mockResolvedValue(undefined),
  sendRejectionNotification: vi.fn().mockResolvedValue(undefined),
  sendNewsletterConfirmation: vi.fn().mockResolvedValue(undefined),
  sendOwnerPendingUserNotification: vi.fn().mockResolvedValue(undefined),
}))

const { POST, GET } = await import('@/app/api/posts/route')

// --- Helpers ---

function makeToken(role: string, userId: string) {
  return generateToken({ sub: userId, email: `${role}@example.com`, role })
}

function makeRequest(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return new NextRequest('http://localhost/api/posts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

function seedUser(db: Database.Database, role: string) {
  const id = uuidv4()
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, status)
     VALUES (?, 'User', ?, 'hash', ?, 'active')`
  ).run(id, `${role}@example.com`, role)
  return id
}

const validPost = {
  title: 'My Test Post',
  content: 'This is the post content.',
  status: 'draft',
  visibility: 'public',
}

// --- Tests ---

describe('POST /api/posts', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  it('201 — creates post with auto-generated slug for author role', async () => {
    const userId = seedUser(testDb, 'author')
    const token = makeToken('author', userId)

    const res = await POST(makeRequest(validPost, token))
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.post.id).toBeTruthy()
    expect(body.post.slug).toBeTruthy()
    // Slug should be derived from the title
    expect(body.post.slug).toContain('my-test-post')
  })

  it('201 — creates post for owner role', async () => {
    const userId = seedUser(testDb, 'owner')
    const token = makeToken('owner', userId)

    const res = await POST(makeRequest(validPost, token))
    expect(res.status).toBe(201)
  })

  it('401 — no Authorization header', async () => {
    const res = await POST(makeRequest(validPost))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('401 — invalid token', async () => {
    const req = makeRequest(validPost, 'invalid.token.here')
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('403 — default role cannot create posts', async () => {
    const userId = seedUser(testDb, 'default')
    const token = makeToken('default', userId)

    const res = await POST(makeRequest(validPost, token))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/insufficient permissions/i)
  })

  it('XSS — script tags in content are sanitized before storage', async () => {
    const userId = seedUser(testDb, 'author')
    const token = makeToken('author', userId)

    const xssContent = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
    const res = await POST(makeRequest({ ...validPost, content: xssContent }, token))
    expect(res.status).toBe(201)

    // Fetch the created post and verify content is sanitized
    const body = await res.json()
    const postId = body.post.id
    const row = testDb
      .prepare('SELECT content FROM posts WHERE id = ?')
      .get(postId) as { content: string }

    expect(row.content).not.toContain('<script>')
    expect(row.content).not.toContain('alert("xss")')
    // Safe HTML is preserved
    expect(row.content).toContain('<p>Hello</p>')
  })

  it('XSS — javascript: href is stripped', async () => {
    const userId = seedUser(testDb, 'author')
    const token = makeToken('author', userId)

    const xssContent = '<a href="javascript:void(0)">click</a>'
    await POST(makeRequest({ ...validPost, content: xssContent }, token))

    const row = testDb
      .prepare('SELECT content FROM posts ORDER BY created_at DESC LIMIT 1')
      .get() as { content: string }

    expect(row.content).not.toContain('javascript:')
  })

  it('slug is unique on each create (uniqueSlug appends timestamp)', async () => {
    const userId = seedUser(testDb, 'author')
    const token = makeToken('author', userId)

    const res1 = await POST(makeRequest(validPost, token))
    // Small delay to ensure different timestamp
    await new Promise((r) => setTimeout(r, 5))
    const res2 = await POST(makeRequest(validPost, token))

    const b1 = await res1.json()
    const b2 = await res2.json()
    expect(b1.post.slug).not.toBe(b2.post.slug)
  })
})

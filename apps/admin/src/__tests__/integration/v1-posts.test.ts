/**
 * Integration tests for GET /api/v1/posts
 *
 * Calls the Next.js route handler directly with a real in-memory SQLite DB.
 * Mocks: @/lib/db, @/lib/rate-limit (to control rate-limit behavior).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createTestDb } from '../helpers/db'
import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

// --- Module mocks ---

let testDb: Database.Database

vi.mock('@/lib/db', () => ({
  getDb: () => testDb,
  getSetting: vi.fn().mockReturnValue(null),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({
    allowed: true,
    limit: 60,
    remaining: 59,
    reset: Math.floor(Date.now() / 1000) + 60,
  }),
}))

const { GET } = await import('@/app/api/v1/posts/route')
import { checkRateLimit } from '@/lib/rate-limit'

// --- Helpers ---

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/v1/posts')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

function seedAuthor(db: Database.Database) {
  const id = uuidv4()
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, status)
     VALUES (?, 'Author', 'author@example.com', 'hash', 'author', 'active')`
  ).run(id)
  return id
}

function seedPost(
  db: Database.Database,
  authorId: string,
  opts: {
    title?: string
    status?: string
    visibility?: string
    slug?: string
  } = {}
) {
  const id = uuidv4()
  const {
    title = 'Test Post',
    status = 'published',
    visibility = 'public',
    slug = `slug-${id}`,
  } = opts
  db.prepare(
    `INSERT INTO posts (id, title, slug, content, status, visibility, author_id)
     VALUES (?, ?, ?, 'content', ?, ?, ?)`
  ).run(id, title, slug, status, visibility, authorId)
  return id
}

// --- Tests ---

describe('GET /api/v1/posts', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  it('returns only published+public posts', async () => {
    const authorId = seedAuthor(testDb)
    const pubId = seedPost(testDb, authorId, { title: 'Public Post', status: 'published', visibility: 'public' })
    seedPost(testDb, authorId, { title: 'Draft Post', status: 'draft', visibility: 'public' })
    seedPost(testDb, authorId, { title: 'Private Post', status: 'published', visibility: 'iPrivate' })

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe(pubId)
  })

  it('includes X-RateLimit-* headers', async () => {
    const res = await GET(makeRequest())
    expect(res.headers.get('x-ratelimit-limit')).toBe('60')
    expect(res.headers.get('x-ratelimit-remaining')).toBe('59')
    expect(res.headers.get('x-ratelimit-reset')).toBeTruthy()
  })

  it('includes security headers', async () => {
    const res = await GET(makeRequest())
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('paginates results with page and limit params', async () => {
    const authorId = seedAuthor(testDb)
    for (let i = 0; i < 5; i++) {
      seedPost(testDb, authorId, { title: `Post ${i}` })
    }

    const res = await GET(makeRequest({ page: '1', limit: '2' }))
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.meta.total).toBe(5)
    expect(body.meta.total_pages).toBe(3)
    expect(body.meta.has_next).toBe(true)
    expect(body.meta.has_prev).toBe(false)
  })

  it('page 2 returns next set of results', async () => {
    const authorId = seedAuthor(testDb)
    for (let i = 0; i < 5; i++) {
      seedPost(testDb, authorId, { title: `Post ${i}` })
    }

    const res = await GET(makeRequest({ page: '2', limit: '2' }))
    const body = await res.json()
    expect(body.data).toHaveLength(2)
    expect(body.meta.has_prev).toBe(true)
  })

  it('returns 429 when rate limit is exceeded', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      limit: 60,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 60,
    })

    const res = await GET(makeRequest())
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('returns empty data array when no posts exist', async () => {
    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.data).toHaveLength(0)
    expect(body.meta.total).toBe(0)
  })
})

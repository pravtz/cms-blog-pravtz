import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type Database from 'better-sqlite3'
import { createTestDb, getSettingFromDb } from '../helpers/db'

let testDb: Database.Database

const { logAudit } = vi.hoisted(() => ({
  logAudit: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getDb: () => testDb,
  ownerExists: () =>
    Boolean(
      testDb
        .prepare("SELECT 1 FROM users WHERE role = 'owner' LIMIT 1")
        .get()
    ),
}))

vi.mock('@/lib/audit', () => ({
  logAudit,
}))

const { POST } = await import('@/app/api/setup/complete/route')

function makeRequest(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/setup/complete', {
    method: 'POST',
    body: JSON.stringify({
      ownerName: 'Owner Teste',
      ownerEmail: 'owner@example.com',
      ownerPassword: 'OwnerPass123!',
      dbType: 'sqlite',
      blogName: 'Blog de Teste',
      blogDescription: 'Descricao',
      blogUrl: 'http://localhost:3900',
      ...overrides,
    }),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'vitest',
    },
  })
}

describe('POST /api/setup/complete', () => {
  beforeEach(() => {
    testDb = createTestDb()
    vi.clearAllMocks()
    process.env.NODE_ENV = 'test'
  })

  it('creates the owner, saves settings, and seeds 10 local posts on an empty database', async () => {
    const res = await POST(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })

    const owner = testDb
      .prepare("SELECT id, email, role, status FROM users WHERE role = 'owner'")
      .get() as { id: string; email: string; role: string; status: string } | undefined

    expect(owner).toMatchObject({
      email: 'owner@example.com',
      role: 'owner',
      status: 'active',
    })
    expect(getSettingFromDb(testDb, 'setup_complete')).toBe('true')
    expect(getSettingFromDb(testDb, 'blog_url')).toBe('http://localhost:3900')

    const posts = testDb
      .prepare(
        `SELECT title, slug, status, visibility, author_id
         FROM posts
         ORDER BY publish_date DESC, created_at DESC`
      )
      .all() as Array<{
      title: string
      slug: string
      status: string
      visibility: string
      author_id: string
    }>

    expect(posts).toHaveLength(10)
    expect(new Set(posts.map((post) => post.slug)).size).toBe(10)
    expect(posts[0]).toMatchObject({
      title: 'Post de exemplo 01',
      slug: 'post-de-exemplo-01',
      status: 'published',
      visibility: 'public',
      author_id: owner!.id,
    })
    expect(logAudit).toHaveBeenCalledTimes(1)
  })

  it('does not duplicate seed posts when setup is called again after completion', async () => {
    const firstResponse = await POST(makeRequest())
    expect(firstResponse.status).toBe(200)

    const secondResponse = await POST(makeRequest())
    expect(secondResponse.status).toBe(409)

    const { total } = testDb
      .prepare('SELECT COUNT(*) AS total FROM posts')
      .get() as { total: number }

    expect(total).toBe(10)
  })

  it('skips the local seed when posts already exist before setup completes', async () => {
    testDb
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, role, status)
         VALUES ('author-1', 'Autor', 'autor@example.com', 'hash', 'author', 'active')`
      )
      .run()

    testDb
      .prepare(
        `INSERT INTO posts (id, title, slug, content, status, visibility, author_id)
         VALUES ('post-1', 'Ja existente', 'ja-existente', 'conteudo', 'published', 'public', 'author-1')`
      )
      .run()

    const res = await POST(makeRequest())
    expect(res.status).toBe(200)

    const rows = testDb
      .prepare('SELECT slug FROM posts ORDER BY slug ASC')
      .all() as Array<{ slug: string }>

    expect(rows).toHaveLength(1)
    expect(rows[0]?.slug).toBe('ja-existente')
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { createTestDb } from '../helpers/db'
import { generateToken } from '@/lib/auth'

let testDb: Database.Database

vi.mock('@/lib/db', () => ({
  getDb: () => testDb,
}))

const { GET, POST } = await import('@/app/api/admin/categories/route')

function seedUser(db: Database.Database, role: string) {
  const id = uuidv4()
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, status)
     VALUES (?, 'User', ?, 'hash', ?, 'active')`
  ).run(id, `${role}@example.com`, role)
  return id
}

function makeToken(role: string, userId: string) {
  return generateToken({ sub: userId, email: `${role}@example.com`, role })
}

function makeRequest(body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  return new NextRequest('http://localhost/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

describe('POST /api/admin/categories', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  it('creates a category for owner role', async () => {
    const userId = seedUser(testDb, 'owner')
    const token = makeToken('owner', userId)

    const res = await POST(makeRequest({ name: 'Tecnologia' }, token))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.category).toMatchObject({
      name: 'Tecnologia',
      slug: 'tecnologia',
    })
  })

  it('works with legacy categories schema without created_at', async () => {
    testDb.prepare('DROP TABLE categories').run()
    testDb.exec(`
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE
      );
    `)

    const userId = seedUser(testDb, 'owner')
    const token = makeToken('owner', userId)

    const createRes = await POST(makeRequest({ name: 'Negócios' }, token))
    expect(createRes.status).toBe(201)

    const listRes = await GET(
      new NextRequest('http://localhost/api/admin/categories', {
        headers: { Authorization: `Bearer ${token}` },
      })
    )

    expect(listRes.status).toBe(200)
    const body = await listRes.json()
    expect(body.categories).toEqual([
      expect.objectContaining({
        name: 'Negócios',
        slug: 'negocios',
      }),
    ])
  })
})

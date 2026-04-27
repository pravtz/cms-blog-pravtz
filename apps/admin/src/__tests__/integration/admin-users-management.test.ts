import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { createTestDb } from '../helpers/db'
import { generateToken, verifyPassword } from '@/lib/auth'

let testDb: Database.Database

vi.mock('@/lib/db', () => ({
  getDb: () => testDb,
}))

vi.mock('@/lib/email', () => ({
  sendApprovalNotification: vi.fn().mockResolvedValue(undefined),
  sendRejectionNotification: vi.fn().mockResolvedValue(undefined),
}))

const usersRoute = await import('@/app/api/admin/users/route')
const userRoute = await import('@/app/api/admin/users/[id]/route')
const resetPasswordRoute = await import('@/app/api/admin/users/[id]/reset-password/route')

function seedUser(
  db: Database.Database,
  role: string,
  overrides: Partial<{ id: string; name: string; email: string; phone: string; nickname: string; status: string }> = {}
) {
  const id = overrides.id ?? uuidv4()
  db.prepare(
    `INSERT INTO users (id, name, nickname, email, phone, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, 'hash', ?, ?)`
  ).run(
    id,
    overrides.name ?? 'User',
    overrides.nickname ?? null,
    overrides.email ?? `${role}-${id}@example.com`,
    overrides.phone ?? null,
    role,
    overrides.status ?? 'active',
  )
  return id
}

function tokenFor(role: string, userId: string) {
  return generateToken({ sub: userId, email: `${role}@example.com`, role })
}

function jsonRequest(url: string, method: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers,
  })
}

describe('admin user management', () => {
  beforeEach(() => {
    testDb = createTestDb()
    vi.clearAllMocks()
  })

  it('owner can create a user and assign custom groups', async () => {
    const ownerId = seedUser(testDb, 'owner', { email: 'owner@example.com' })
    testDb
      .prepare(`INSERT INTO groups (id, name, description, is_system) VALUES ('group-editors', 'Editors', 'Editors group', 0)`)
      .run()

    const res = await usersRoute.POST(
      jsonRequest(
        'http://localhost/api/admin/users',
        'POST',
        {
          name: 'Maria',
          nickname: 'maria',
          email: 'maria@example.com',
          phone: '555-1000',
          password: 'SecurePass123!',
          role: 'editor',
          groupIds: ['group-editors'],
        },
        tokenFor('owner', ownerId),
      ),
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.user).toMatchObject({
      name: 'Maria',
      nickname: 'maria',
      email: 'maria@example.com',
      phone: '555-1000',
      role: 'editor',
      status: 'active',
    })

    const groups = testDb
      .prepare('SELECT group_id FROM group_members WHERE user_id = ? ORDER BY group_id')
      .all(body.user.id) as Array<{ group_id: string }>

    expect(groups.map((entry) => entry.group_id)).toEqual(['group-default', 'group-editors'])
  })

  it('admin cannot create a user', async () => {
    const adminId = seedUser(testDb, 'admin', { email: 'admin@example.com' })

    const res = await usersRoute.POST(
      jsonRequest(
        'http://localhost/api/admin/users',
        'POST',
        {
          name: 'Blocked',
          email: 'blocked@example.com',
          password: 'SecurePass123!',
          role: 'default',
          groupIds: [],
        },
        tokenFor('admin', adminId),
      ),
    )

    expect(res.status).toBe(403)
  })

  it('owner can update user profile fields and groups', async () => {
    const ownerId = seedUser(testDb, 'owner', { email: 'owner@example.com' })
    const targetId = seedUser(testDb, 'default', { email: 'person@example.com', name: 'Person' })
    testDb
      .prepare(`INSERT INTO groups (id, name, description, is_system) VALUES ('group-reviewers', 'Reviewers', 'Reviewers group', 0)`)
      .run()

    const res = await userRoute.PATCH(
      jsonRequest(
        `http://localhost/api/admin/users/${targetId}`,
        'PATCH',
        {
          name: 'Person Updated',
          nickname: 'reviewer',
          email: 'updated@example.com',
          phone: '555-2000',
          role: 'admin',
          groupIds: ['group-reviewers'],
        },
        tokenFor('owner', ownerId),
      ),
      { params: { id: targetId } },
    )

    expect(res.status).toBe(200)

    const row = testDb
      .prepare('SELECT name, nickname, email, phone, role FROM users WHERE id = ?')
      .get(targetId) as { name: string; nickname: string; email: string; phone: string; role: string }

    expect(row).toEqual({
      name: 'Person Updated',
      nickname: 'reviewer',
      email: 'updated@example.com',
      phone: '555-2000',
      role: 'admin',
    })
  })

  it('owner can reset password for a non-owner user', async () => {
    const ownerId = seedUser(testDb, 'owner', { email: 'owner@example.com' })
    const targetId = seedUser(testDb, 'default', { email: 'member@example.com' })

    const res = await resetPasswordRoute.POST(
      jsonRequest(
        `http://localhost/api/admin/users/${targetId}/reset-password`,
        'POST',
        { password: 'NewSecurePass123!' },
        tokenFor('owner', ownerId),
      ),
      { params: { id: targetId } },
    )

    expect(res.status).toBe(200)

    const row = testDb
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(targetId) as { password_hash: string }

    await expect(verifyPassword('NewSecurePass123!', row.password_hash)).resolves.toBe(true)
  })
})

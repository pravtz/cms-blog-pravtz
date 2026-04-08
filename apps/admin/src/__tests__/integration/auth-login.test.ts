/**
 * Integration tests for POST /api/auth/login
 *
 * Calls the Next.js route handler directly with a real in-memory SQLite DB.
 * Mocks: @/lib/db (returns in-memory DB), @/lib/email (no-op).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createTestDb } from '../helpers/db'
import { hashPassword } from '@/lib/auth'
import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'

// --- Module mocks (hoisted) ---

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

// Import the route handler AFTER mock setup
const { POST } = await import('@/app/api/auth/login/route')

// --- Helpers ---

function makeRequest(body: unknown, ip = '127.0.0.1') {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
  })
}

async function seedUser(
  db: Database.Database,
  opts: {
    email?: string
    password?: string
    status?: string
    role?: string
  } = {}
) {
  const {
    email = 'user@example.com',
    password = 'password123',
    status = 'active',
    role = 'author',
  } = opts

  const id = uuidv4()
  const hash = await hashPassword(password)
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, role, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, 'Test User', email, hash, role, status)
  return { id, email, password, status, role }
}

// --- Tests ---

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  it('200 — returns accessToken and sets httpOnly refreshToken cookie for active user', async () => {
    await seedUser(testDb)
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'password123' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accessToken).toBeTruthy()
    expect(body.user.email).toBe('user@example.com')

    // httpOnly refreshToken cookie
    const cookie = res.headers.get('set-cookie')
    expect(cookie).toContain('refreshToken=')
    expect(cookie).toContain('HttpOnly')
  })

  it('401 — wrong password', async () => {
    await seedUser(testDb)
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'wrongpassword' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/invalid email or password/i)
  })

  it('401 — unknown email', async () => {
    const res = await POST(makeRequest({ email: 'nobody@example.com', password: 'any' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/invalid email or password/i)
  })

  it('403 — pending_email status', async () => {
    await seedUser(testDb, { status: 'pending_email' })
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'password123' }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/confirm your email/i)
  })

  it('403 — pending_approval status', async () => {
    await seedUser(testDb, { status: 'pending_approval' })
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'password123' }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/awaiting admin approval/i)
  })

  it('403 — suspended status', async () => {
    await seedUser(testDb, { status: 'suspended' })
    const res = await POST(makeRequest({ email: 'user@example.com', password: 'password123' }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/suspended/i)
  })

  it('429 — IP blocked after 5 failed attempts', async () => {
    const ip = '10.0.0.1'
    // Use ISO format so the `attempted_at > windowStart` SQLite comparison works correctly.
    // SQLite datetime('now') format ('YYYY-MM-DD HH:MM:SS') sorts BEFORE ISO format
    // ('YYYY-MM-DDTHH:MM:SS.sssZ') due to space < 'T' in ASCII, breaking the window query.
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()
    for (let i = 0; i < 5; i++) {
      testDb
        .prepare(
          `INSERT INTO login_attempts (ip_address, email, success, attempted_at)
           VALUES (?, ?, 0, ?)`
        )
        .run(ip, 'user@example.com', oneMinuteAgo)
    }

    const res = await POST(makeRequest({ email: 'user@example.com', password: 'any' }, ip))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toMatch(/too many failed attempts/i)
  })

  it('400 — missing fields', async () => {
    const res = await POST(makeRequest({ email: 'notanemail' }))
    expect(res.status).toBe(400)
  })
})

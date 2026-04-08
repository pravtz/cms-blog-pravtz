/**
 * Integration tests for Newsletter Double Opt-in flow:
 *  - POST /api/blog/newsletter     → subscriber created (pending)
 *  - GET  /api/blog/newsletter/confirm?token=... → subscriber activated (active)
 *  - GET  /api/blog/newsletter/confirm?token=... expired → 400
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

vi.mock('@/lib/email', () => ({
  sendEmailConfirmation: vi.fn().mockResolvedValue(undefined),
  sendApprovalNotification: vi.fn().mockResolvedValue(undefined),
  sendRejectionNotification: vi.fn().mockResolvedValue(undefined),
  sendNewsletterConfirmation: vi.fn().mockResolvedValue(undefined),
  sendOwnerPendingUserNotification: vi.fn().mockResolvedValue(undefined),
}))

const { POST: subscribePost } = await import('@/app/api/blog/newsletter/route')
const { GET: confirmGet } = await import('@/app/api/blog/newsletter/confirm/route')

// --- Helpers ---

function makeSubscribeRequest(email: unknown) {
  return new NextRequest('http://localhost/api/blog/newsletter', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeConfirmRequest(token: string) {
  return new NextRequest(
    `http://localhost/api/blog/newsletter/confirm?token=${encodeURIComponent(token)}`
  )
}

function getSubscriber(db: Database.Database, email: string) {
  return db
    .prepare('SELECT * FROM newsletter_subscribers WHERE email = ?')
    .get(email) as {
    id: string
    email: string
    status: string
    token: string | null
    token_expires: string | null
    confirmed_at: string | null
  } | undefined
}

// --- Tests ---

describe('Newsletter Double Opt-in', () => {
  beforeEach(() => {
    testDb = createTestDb()
  })

  describe('POST /api/blog/newsletter — subscribe', () => {
    it('creates a new subscriber with status=pending', async () => {
      const res = await subscribePost(makeSubscribeRequest('new@example.com'))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.ok).toBe(true)

      const sub = getSubscriber(testDb, 'new@example.com')
      expect(sub).toBeDefined()
      expect(sub!.status).toBe('pending')
      expect(sub!.token).toBeTruthy()
    })

    it('returns 200 (silent success) for already-active subscriber', async () => {
      // Seed an active subscriber
      testDb
        .prepare(
          `INSERT INTO newsletter_subscribers (id, email, status, token, token_expires, unsubscribe_token)
           VALUES (?, 'active@example.com', 'active', NULL, NULL, ?)`
        )
        .run(uuidv4(), uuidv4())

      const res = await subscribePost(makeSubscribeRequest('active@example.com'))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it('refreshes token for pending subscriber', async () => {
      // First subscription
      await subscribePost(makeSubscribeRequest('pending@example.com'))
      const firstSub = getSubscriber(testDb, 'pending@example.com')
      const firstToken = firstSub!.token

      // Subscribe again
      await subscribePost(makeSubscribeRequest('pending@example.com'))
      const refreshedSub = getSubscriber(testDb, 'pending@example.com')

      // Token should be refreshed (different)
      expect(refreshedSub!.token).not.toBe(firstToken)
      expect(refreshedSub!.status).toBe('pending')
    })

    it('400 for invalid email', async () => {
      const res = await subscribePost(makeSubscribeRequest('notanemail'))
      expect(res.status).toBe(400)
    })

    it('400 for missing email', async () => {
      const res = await subscribePost(makeSubscribeRequest(null))
      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/blog/newsletter/confirm — confirm subscription', () => {
    it('activates subscriber and clears token on valid token', async () => {
      // Subscribe first
      await subscribePost(makeSubscribeRequest('confirm@example.com'))
      const sub = getSubscriber(testDb, 'confirm@example.com')
      const token = sub!.token!

      const res = await confirmGet(makeConfirmRequest(token))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)

      const confirmed = getSubscriber(testDb, 'confirm@example.com')
      expect(confirmed!.status).toBe('active')
      expect(confirmed!.token).toBeNull()
      expect(confirmed!.confirmed_at).toBeTruthy()
    })

    it('400 for unknown token', async () => {
      const res = await confirmGet(makeConfirmRequest('unknown-token-uuid'))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBeTruthy()
    })

    it('400 for expired token', async () => {
      const id = uuidv4()
      const token = uuidv4()
      // Use ISO format so new Date(token_expires) parses correctly in the route
      const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString()
      testDb
        .prepare(
          `INSERT INTO newsletter_subscribers
             (id, email, status, token, token_expires, unsubscribe_token)
           VALUES (?, 'expired@example.com', 'pending', ?, ?, ?)`
        )
        .run(id, token, expiredAt, uuidv4())

      const res = await confirmGet(makeConfirmRequest(token))
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toMatch(/expirado/i)
    })

    it('200 with "already confirmed" message for already-active subscriber', async () => {
      const id = uuidv4()
      const token = uuidv4()
      testDb
        .prepare(
          `INSERT INTO newsletter_subscribers
             (id, email, status, token, token_expires, unsubscribe_token, confirmed_at)
           VALUES (?, 'already@example.com', 'active', ?, datetime('now', '+1 day'), ?, datetime('now'))`
        )
        .run(id, token, uuidv4())

      const res = await confirmGet(makeConfirmRequest(token))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.ok).toBe(true)
    })

    it('400 when no token query param is provided', async () => {
      const res = await confirmGet(
        new NextRequest('http://localhost/api/blog/newsletter/confirm')
      )
      expect(res.status).toBe(400)
    })
  })
})

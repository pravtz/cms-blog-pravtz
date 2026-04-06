export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendNewsletterConfirmation } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

const BLOG_URL = process.env.BLOG_URL ?? 'http://localhost:3000'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : null

  if (!email || !email.includes('@') || email.length > 255) {
    return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
  }

  const db = getDb()
  const existing = db
    .prepare('SELECT id, status FROM newsletter_subscribers WHERE email = ?')
    .get(email) as { id: string; status: string } | undefined

  if (existing) {
    if (existing.status === 'active') {
      // Silent success — don't reveal subscriber status
      return NextResponse.json({ ok: true })
    }

    // pending or unsubscribed — refresh token and resend
    const token = uuidv4()
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const unsubscribeToken = existing.status === 'unsubscribed' ? uuidv4() : undefined

    if (unsubscribeToken) {
      db.prepare(
        `UPDATE newsletter_subscribers
         SET status = 'pending', token = ?, token_expires = ?,
             unsubscribe_token = ?, confirmed_at = NULL,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(token, expires, unsubscribeToken, existing.id)
    } else {
      db.prepare(
        `UPDATE newsletter_subscribers
         SET token = ?, token_expires = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(token, expires, existing.id)
    }

    await sendNewsletterConfirmation(email, token, BLOG_URL)
    return NextResponse.json({ ok: true })
  }

  // New subscriber
  const id = uuidv4()
  const token = uuidv4()
  const unsubscribeToken = uuidv4()
  const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  db.prepare(
    `INSERT INTO newsletter_subscribers (id, email, status, token, token_expires, unsubscribe_token)
     VALUES (?, ?, 'pending', ?, ?, ?)`
  ).run(id, email, token, expires, unsubscribeToken)

  await sendNewsletterConfirmation(email, token, BLOG_URL)
  return NextResponse.json({ ok: true }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { sendOwnerPendingUserNotification } from '@/lib/email'
import { dispatchChannelNotification } from '@/lib/channel-notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface UserRow {
  id: string
  name: string
  email: string
  status: string
  email_token_expires: string
}

interface OwnerRow {
  email: string
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const token = (body as Record<string, unknown>)?.token
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Token is required.' }, { status: 400 })
  }

  const db = getDb()
  const user = db
    .prepare(
      `SELECT id, name, email, status, email_token_expires
       FROM users WHERE email_token = ?`
    )
    .get(token) as UserRow | undefined

  if (!user) {
    return NextResponse.json(
      { error: 'Invalid or already-used confirmation token.' },
      { status: 400 }
    )
  }

  if (user.status !== 'pending_email') {
    if (user.status === 'pending_approval' || user.status === 'active') {
      return NextResponse.json(
        { message: 'Email already confirmed.' },
        { status: 200 }
      )
    }
    return NextResponse.json(
      { error: 'Account cannot be confirmed in its current state.' },
      { status: 400 }
    )
  }

  const now = new Date()
  const expires = new Date(user.email_token_expires)
  if (now > expires) {
    return NextResponse.json(
      { error: 'Confirmation token has expired. Please request a new one.' },
      { status: 400 }
    )
  }

  db.prepare(
    `UPDATE users
     SET status = 'pending_approval', email_token = NULL, email_token_expires = NULL,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(user.id)

  // Notify owner(s) about the new pending user
  const owner = db
    .prepare("SELECT email FROM users WHERE role = 'owner' LIMIT 1")
    .get() as OwnerRow | undefined

  if (owner) {
    await sendOwnerPendingUserNotification(owner.email, user.name, user.email)
  }

  // Dispatch to configured notification channels (non-blocking)
  dispatchChannelNotification('new_pending_user', {
    title: 'New user pending approval',
    message: `${user.name} (${user.email}) confirmed their email and is awaiting approval.`,
    link: `${process.env.NEXT_PUBLIC_ADMIN_URL ?? ''}/admin/users`,
  }).catch(() => { /* non-blocking */ })

  return NextResponse.json(
    { message: 'Email confirmed. Your account is pending admin approval.' },
    { status: 200 }
  )
}

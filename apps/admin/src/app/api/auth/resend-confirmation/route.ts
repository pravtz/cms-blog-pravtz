import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { generateEmailToken, emailTokenExpiry } from '@/lib/auth'
import { sendEmailConfirmation } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ResendSchema = z.object({
  email: z.string().email(),
})

interface UserRow {
  id: string
  name: string
  email: string
  status: string
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = ResendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  const { email } = parsed.data
  const db = getDb()

  const user = db
    .prepare('SELECT id, name, email, status FROM users WHERE email = ?')
    .get(email) as UserRow | undefined

  // Always return the same response to avoid email enumeration
  const genericResponse = NextResponse.json(
    { message: 'If your email is pending confirmation, a new link has been sent.' },
    { status: 200 }
  )

  if (!user || user.status !== 'pending_email') {
    return genericResponse
  }

  const newToken = generateEmailToken()
  const newExpiry = emailTokenExpiry()

  db.prepare(
    `UPDATE users
     SET email_token = ?, email_token_expires = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(newToken, newExpiry, user.id)

  await sendEmailConfirmation(email, user.name, newToken)

  return genericResponse
}

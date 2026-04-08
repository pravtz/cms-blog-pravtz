import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getDb, ownerExists } from '@/lib/db'
import { hashPassword, generateEmailToken, emailTokenExpiry } from '@/lib/auth'
import { sendEmailConfirmation } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  nickname: z.string().min(2).max(50).optional(),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  password: z.string().min(8).max(128),
})

export async function POST(request: NextRequest) {
  if (!ownerExists()) {
    return NextResponse.json(
      { error: 'Setup has not been completed.' },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, nickname, email, phone, password } = parsed.data
  const db = getDb()

  const existing = db
    .prepare('SELECT id FROM users WHERE email = ?')
    .get(email)

  if (existing) {
    // Return same message to avoid email enumeration
    return NextResponse.json(
      { message: 'If this email is not already registered, a confirmation link has been sent.' },
      { status: 200 }
    )
  }

  const passwordHash = await hashPassword(password)
  const emailToken = generateEmailToken()
  const tokenExpires = emailTokenExpiry()
  const userId = randomUUID()

  db.prepare(
    `INSERT INTO users (id, name, nickname, email, phone, password_hash, role, status, email_token, email_token_expires)
     VALUES (?, ?, ?, ?, ?, ?, 'default', 'pending_email', ?, ?)`
  ).run(userId, name, nickname ?? null, email, phone ?? null, passwordHash, emailToken, tokenExpires)

  await sendEmailConfirmation(email, name, emailToken)

  return NextResponse.json(
    { message: 'Registration successful. Please check your email to confirm your address.' },
    { status: 201 }
  )
}

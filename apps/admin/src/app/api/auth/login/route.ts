import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword, generateToken, generateRefreshToken } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const BRUTE_FORCE_MAX_ATTEMPTS = 5
const BRUTE_FORCE_BLOCK_MS = 30 * 60 * 1000 // 30 minutes

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

interface UserRow {
  id: string
  name: string
  email: string
  password_hash: string
  role: string
  status: string
  first_login_done: number
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

function isIPBlocked(db: ReturnType<typeof getDb>, ip: string): boolean {
  const blockWindowStart = new Date(Date.now() - BRUTE_FORCE_BLOCK_MS).toISOString()
  const windowStart = new Date(Date.now() - BRUTE_FORCE_WINDOW_MS).toISOString()

  const recentFailures = db
    .prepare(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE ip_address = ? AND success = 0 AND attempted_at > ?`
    )
    .get(ip, windowStart) as { count: number }

  // If 5+ failures in last 15 min, check if the block period hasn't expired
  if (recentFailures.count >= BRUTE_FORCE_MAX_ATTEMPTS) {
    const oldestFailure = db
      .prepare(
        `SELECT attempted_at FROM login_attempts
         WHERE ip_address = ? AND success = 0
         ORDER BY attempted_at DESC
         LIMIT 1 OFFSET ${BRUTE_FORCE_MAX_ATTEMPTS - 1}`
      )
      .get(ip) as { attempted_at: string } | undefined

    if (oldestFailure && oldestFailure.attempted_at > blockWindowStart) {
      return true
    }
  }

  return false
}

function recordAttempt(
  db: ReturnType<typeof getDb>,
  ip: string,
  email: string | null,
  success: boolean
) {
  db.prepare(
    'INSERT INTO login_attempts (ip_address, email, success) VALUES (?, ?, ?)'
  ).run(ip, email, success ? 1 : 0)
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const db = getDb()

  if (isIPBlocked(db, ip)) {
    logAudit({
      action: 'login.blocked',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json(
      { error: 'Too many failed attempts. Please try again in 30 minutes.' },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const { email, password } = parsed.data

  const user = db
    .prepare('SELECT * FROM users WHERE email = ?')
    .get(email) as UserRow | undefined

  if (!user) {
    recordAttempt(db, ip, email, false)
    logAudit({
      action: 'login.failure',
      actorEmail: email,
      metadata: { reason: 'user_not_found' },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const passwordValid = await verifyPassword(password, user.password_hash)
  if (!passwordValid) {
    recordAttempt(db, ip, email, false)
    logAudit({
      action: 'login.failure',
      actorId: user.id,
      actorEmail: email,
      metadata: { reason: 'wrong_password' },
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    })
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  if (user.status !== 'active') {
    const messages: Record<string, string> = {
      pending_email: 'Please confirm your email address before signing in.',
      pending_approval: 'Your account is awaiting admin approval.',
      suspended: 'Your account has been suspended. Contact an administrator.',
    }
    return NextResponse.json(
      { error: messages[user.status] ?? 'Account is not active.' },
      { status: 403 }
    )
  }

  recordAttempt(db, ip, email, true)
  logAudit({
    action: 'login.success',
    actorId: user.id,
    actorEmail: user.email,
    ipAddress: ip,
    userAgent: request.headers.get('user-agent'),
  })

  const tokenPayload = { sub: user.id, email: user.email, role: user.role }
  const accessToken = generateToken(tokenPayload)
  const refreshToken = generateRefreshToken(tokenPayload)

  const firstLogin = user.first_login_done === 0 && user.role !== 'owner'

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken,
    firstLogin,
  })

  response.cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  })

  return response
}

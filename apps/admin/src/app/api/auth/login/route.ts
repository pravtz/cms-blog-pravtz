import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { verifyPassword, generateToken, generateRefreshToken } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { dispatchChannelNotification } from '@/lib/channel-notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const BRUTE_FORCE_MAX_ATTEMPTS = 5
const RETRY_AFTER_SECONDS = 900 // 15 minutes in seconds

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

// In-memory store for login failure rate limiting (fallback, no Redis/DB dependency)
const loginFailures = new Map<string, { count: number; resetAt: number }>()

function isLoginBlocked(ip: string): { blocked: boolean; retryAfter: number } {
  const now = Date.now()
  const entry = loginFailures.get(ip)
  if (!entry || entry.resetAt < now) {
    return { blocked: false, retryAfter: 0 }
  }
  if (entry.count >= BRUTE_FORCE_MAX_ATTEMPTS) {
    return {
      blocked: true,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    }
  }
  return { blocked: false, retryAfter: 0 }
}

function recordLoginFailure(ip: string): void {
  const now = Date.now()
  const entry = loginFailures.get(ip)
  if (!entry || entry.resetAt < now) {
    loginFailures.set(ip, { count: 1, resetAt: now + BRUTE_FORCE_WINDOW_MS })
  } else {
    entry.count++
  }
}

function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'
  )
}

function recordAttempt(
  db: ReturnType<typeof getDb>,
  ip: string,
  email: string | null,
  success: boolean
) {
  try {
    db.prepare(
      'INSERT INTO login_attempts (ip_address, email, success) VALUES (?, ?, ?)'
    ).run(ip, email, success ? 1 : 0)
  } catch {
    // Non-blocking: audit log failure must not interrupt authentication
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  const db = getDb()

  const { blocked, retryAfter } = isLoginBlocked(ip)
  if (blocked) {
    logAudit({
      action: 'login.blocked',
      ipAddress: ip,
      userAgent: request.headers.get('user-agent'),
    })
    // Dispatch suspicious_login channel notification (non-blocking)
    dispatchChannelNotification('suspicious_login', {
      title: 'Suspicious login attempt blocked',
      message: `IP address ${ip} has been blocked after too many failed login attempts.`,
    }).catch(() => { /* non-blocking */ })
    return NextResponse.json(
      { error: 'Too many failed attempts. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfter > 0 ? retryAfter : RETRY_AFTER_SECONDS) },
      }
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
    recordLoginFailure(ip)
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
    recordLoginFailure(ip)
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

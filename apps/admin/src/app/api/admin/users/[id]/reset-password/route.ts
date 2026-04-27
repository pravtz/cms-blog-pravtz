import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(params.id) as
    { id: string; email: string; role: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (user.role === 'owner' && user.id !== auth.payload.sub) {
    return NextResponse.json({ error: 'Cannot reset another owner password.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', details: parsed.error.flatten() }, { status: 400 })
  }

  const passwordHash = await hashPassword(parsed.data.password)
  db.prepare(
    `UPDATE users
     SET password_hash = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(passwordHash, params.id)

  logAudit({
    action: 'user.password_reset',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: params.id,
    targetType: 'user',
    metadata: { email: user.email },
    ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const db = getDb()

  const user = db.prepare("SELECT id, email, role, status FROM users WHERE id = ?").get(params.id) as
    { id: string; email: string; role: string; status: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (user.status === 'active') {
    return NextResponse.json({ error: 'User is already active.' }, { status: 409 })
  }

  db.prepare("UPDATE users SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(params.id)

  logAudit({
    action: 'user.approved',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: params.id,
    targetType: 'user',
    metadata: { userEmail: user.email, previousStatus: user.status },
    ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}

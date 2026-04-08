import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { sendRejectionNotification } from '@/lib/email'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface UserRow {
  id: string
  name: string
  email: string
  status: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const { id } = params
  const db = getDb()

  const user = db
    .prepare('SELECT id, name, email, status FROM users WHERE id = ?')
    .get(id) as UserRow | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (user.status !== 'pending_approval') {
    return NextResponse.json(
      { error: `Cannot reject user with status '${user.status}'.` },
      { status: 400 }
    )
  }

  // Set status back to pending_email so they can re-register, or keep as rejected
  db.prepare(
    `UPDATE users SET status = 'suspended', updated_at = datetime('now') WHERE id = ?`
  ).run(id)

  await sendRejectionNotification(user.email, user.name)

  logAudit({
    action: 'user.rejected',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: user.id,
    targetType: 'user',
    metadata: { targetEmail: user.email, targetName: user.name },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ message: 'User rejected.' })
}

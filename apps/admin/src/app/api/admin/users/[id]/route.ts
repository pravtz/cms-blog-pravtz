import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const db = getDb()

  const user = db.prepare(`
    SELECT u.id, u.name, u.nickname, u.email, u.phone, u.role, u.status,
           u.created_at, u.updated_at
    FROM users u
    WHERE u.id = ?
  `).get(params.id) as Record<string, unknown> | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  // Get user's groups
  const groups = db.prepare(`
    SELECT g.id, g.name, g.is_system
    FROM groups g
    JOIN group_members gm ON gm.group_id = g.id
    WHERE gm.user_id = ?
    ORDER BY g.name
  `).all(params.id)

  return NextResponse.json({ user: { ...user, groups } })
}

export async function PATCH(
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

  // Prevent modifying owner if not owner
  if (user.role === 'owner' && auth.payload.role !== 'owner') {
    return NextResponse.json({ error: 'Cannot modify owner account.' }, { status: 403 })
  }

  const body = await request.json() as {
    role?: string
    groupIds?: string[]
  }

  const VALID_ROLES = ['default', 'editor', 'admin']

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role.' }, { status: 400 })
    }

    const before = { role: user.role }
    db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
      .run(body.role, params.id)
    logAudit({
      action: 'user.role_changed',
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      targetId: params.id,
      targetType: 'user',
      metadata: { before, after: { role: body.role } },
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    })
  }

  if (body.groupIds !== undefined) {
    // Replace all non-system group memberships
    const tx = db.transaction(() => {
      // Remove from custom groups only (keep system group assignments handled elsewhere)
      db.prepare(`
        DELETE FROM group_members
        WHERE user_id = ?
        AND group_id NOT IN (SELECT id FROM groups WHERE is_system = 1)
      `).run(params.id)

      for (const gid of body.groupIds ?? []) {
        db.prepare("INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)").run(gid, params.id)
      }
    })
    tx()

    logAudit({
      action: 'rbac.user_permissions_changed',
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      targetId: params.id,
      targetType: 'user',
      metadata: { groupIds: body.groupIds },
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    })
  }

  return NextResponse.json({ ok: true })
}

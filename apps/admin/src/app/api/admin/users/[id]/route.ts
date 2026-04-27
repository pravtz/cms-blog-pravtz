import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  nickname: z.string().trim().min(2).max(50).optional().or(z.literal('')),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  role: z.enum(['default', 'editor', 'admin']).optional(),
  groupIds: z.array(z.string().min(1)).optional(),
})

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
  const auth = requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const db = getDb()

  const user = db.prepare("SELECT id, name, nickname, email, phone, role, status FROM users WHERE id = ?").get(params.id) as
    { id: string; name: string; nickname: string | null; email: string; phone: string | null; role: string; status: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (user.role === 'owner' && user.id !== auth.payload.sub) {
    return NextResponse.json({ error: 'Cannot modify another owner account.' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', details: parsed.error.flatten() }, { status: 400 })
  }

  const payload = parsed.data
  const uniqueGroupIds = payload.groupIds ? Array.from(new Set(payload.groupIds)) : undefined
  const normalizedEmail = payload.email?.toLowerCase()

  if (uniqueGroupIds && uniqueGroupIds.length > 0) {
    const placeholders = uniqueGroupIds.map(() => '?').join(', ')
    const validGroups = db
      .prepare(`SELECT id FROM groups WHERE is_system = 0 AND id IN (${placeholders})`)
      .all(...uniqueGroupIds) as Array<{ id: string }>

    if (validGroups.length !== uniqueGroupIds.length) {
      return NextResponse.json({ error: 'One or more groups are invalid.' }, { status: 400 })
    }
  }

  if (normalizedEmail && normalizedEmail !== user.email.toLowerCase()) {
    const existing = db
      .prepare('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?')
      .get(normalizedEmail, params.id) as { id: string } | undefined

    if (existing) {
      return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
    }
  }

  const nextRole = payload.role ?? user.role
  if (user.id === auth.payload.sub && nextRole !== 'owner') {
    return NextResponse.json({ error: 'Owner cannot remove their own owner role.' }, { status: 400 })
  }

  const nextName = payload.name ?? user.name
  const nextNickname = payload.nickname !== undefined ? payload.nickname || null : user.nickname
  const nextEmail = normalizedEmail ?? user.email
  const nextPhone = payload.phone !== undefined ? payload.phone || null : user.phone

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE users
       SET name = ?, nickname = ?, email = ?, phone = ?, role = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(nextName, nextNickname, nextEmail, nextPhone, nextRole, params.id)

    if (uniqueGroupIds !== undefined) {
      db.prepare(`
        DELETE FROM group_members
        WHERE user_id = ?
        AND group_id NOT IN (SELECT id FROM groups WHERE is_system = 1)
      `).run(params.id)

      for (const gid of uniqueGroupIds) {
        db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)').run(gid, params.id)
      }
    }
  })

  tx()

  logAudit({
    action: 'user.updated',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: params.id,
    targetType: 'user',
    metadata: {
      before: {
        name: user.name,
        nickname: user.nickname,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      after: {
        name: nextName,
        nickname: nextNickname,
        email: nextEmail,
        phone: nextPhone,
        role: nextRole,
        groupIds: uniqueGroupIds,
      },
    },
    ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}

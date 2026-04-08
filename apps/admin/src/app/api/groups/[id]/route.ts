import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface GroupRow {
  id: string
  name: string
  description: string | null
  is_system: number
  created_at: string
  updated_at: string
}

interface MemberRow {
  id: string
  name: string
  email: string
  role: string
  status: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(params.id) as GroupRow | undefined
  if (!group) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
  }

  const members = db
    .prepare(`
      SELECT u.id, u.name, u.email, u.role, u.status
      FROM users u
      JOIN group_members gm ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY u.name ASC
    `)
    .all(params.id) as MemberRow[]

  return NextResponse.json({ group, members })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(params.id) as GroupRow | undefined
  if (!group) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
  }
  if (group.is_system) {
    return NextResponse.json({ error: 'System groups cannot be modified.' }, { status: 403 })
  }

  const body = await request.json()
  const { name, description, memberIds } = body as {
    name?: string
    description?: string
    memberIds?: string[]
  }

  if (name !== undefined) {
    if (!name.trim()) {
      return NextResponse.json({ error: 'Group name cannot be empty.' }, { status: 400 })
    }
    const trimmed = name.trim()
    if (trimmed === 'owner' || trimmed === 'default') {
      return NextResponse.json({ error: 'Cannot use reserved group name.' }, { status: 400 })
    }
    try {
      db.prepare(
        "UPDATE groups SET name = ?, description = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(trimmed, description?.trim() ?? group.description, params.id)
    } catch (err: unknown) {
      const e = err as { code?: string }
      if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return NextResponse.json({ error: 'A group with that name already exists.' }, { status: 409 })
      }
      throw err
    }
  }

  if (memberIds !== undefined) {
    const updateMembers = db.transaction((ids: string[]) => {
      db.prepare('DELETE FROM group_members WHERE group_id = ?').run(params.id)
      const insert = db.prepare('INSERT OR IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)')
      for (const uid of ids) {
        insert.run(params.id, uid)
      }
    })
    updateMembers(memberIds)
  }

  const updated = db.prepare('SELECT * FROM groups WHERE id = ?').get(params.id)

  logAudit({
    action: 'group.updated',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: params.id,
    targetType: 'group',
    metadata: { name: name ?? group.name },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ group: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(params.id) as GroupRow | undefined
  if (!group) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
  }
  if (group.is_system) {
    return NextResponse.json({ error: 'System groups cannot be deleted.' }, { status: 403 })
  }

  db.prepare('DELETE FROM groups WHERE id = ?').run(params.id)

  logAudit({
    action: 'group.deleted',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: params.id,
    targetType: 'group',
    metadata: { name: group.name },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface GroupRow {
  id: string
  name: string
  description: string | null
  is_system: number
  member_count: number
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const groups = db
    .prepare(`
      SELECT g.id, g.name, g.description, g.is_system, g.created_at, g.updated_at,
             COUNT(gm.user_id) AS member_count
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      GROUP BY g.id
      ORDER BY g.is_system DESC, g.name ASC
    `)
    .all() as GroupRow[]

  return NextResponse.json({ groups })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const { name, description } = body as { name?: string; description?: string }

  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Group name is required.' }, { status: 400 })
  }

  const trimmedName = name.trim()
  if (trimmedName === 'owner' || trimmedName === 'default') {
    return NextResponse.json({ error: 'Cannot create a group named "owner" or "default".' }, { status: 400 })
  }

  const db = getDb()
  const id = randomUUID()

  try {
    db.prepare(
      'INSERT INTO groups (id, name, description, is_system) VALUES (?, ?, ?, 0)'
    ).run(id, trimmedName, description?.trim() ?? null)
  } catch (err: unknown) {
    const e = err as { code?: string }
    if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json({ error: 'A group with that name already exists.' }, { status: 409 })
    }
    throw err
  }

  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id)
  return NextResponse.json({ group }, { status: 201 })
}

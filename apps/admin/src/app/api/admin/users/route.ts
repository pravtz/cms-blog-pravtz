import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface UserRow {
  id: string
  name: string
  nickname: string | null
  email: string
  phone: string | null
  role: string
  status: string
  created_at: string
  updated_at: string
}

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  nickname: z.string().trim().min(2).max(50).optional().or(z.literal('')),
  email: z.string().trim().email(),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  password: z.string().min(8).max(128),
  role: z.enum(['default', 'editor', 'admin']).default('default'),
  groupIds: z.array(z.string().min(1)).default([]),
})

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  const db = getDb()

  const query = statusFilter
    ? "SELECT id, name, nickname, email, phone, role, status, created_at, updated_at FROM users WHERE status = ? ORDER BY created_at DESC"
    : "SELECT id, name, nickname, email, phone, role, status, created_at, updated_at FROM users ORDER BY created_at DESC"

  const users = statusFilter
    ? db.prepare(query).all(statusFilter) as UserRow[]
    : db.prepare(query).all() as UserRow[]

  return NextResponse.json({ users })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, nickname, email, phone, password, role, groupIds } = parsed.data
  const normalizedEmail = email.toLowerCase()
  const db = getDb()

  const existingUser = db
    .prepare('SELECT id FROM users WHERE lower(email) = lower(?)')
    .get(normalizedEmail) as { id: string } | undefined

  if (existingUser) {
    return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 })
  }

  const uniqueGroupIds = Array.from(new Set(groupIds))
  if (uniqueGroupIds.length > 0) {
    const placeholders = uniqueGroupIds.map(() => '?').join(', ')
    const validGroups = db
      .prepare(`SELECT id FROM groups WHERE is_system = 0 AND id IN (${placeholders})`)
      .all(...uniqueGroupIds) as Array<{ id: string }>

    if (validGroups.length !== uniqueGroupIds.length) {
      return NextResponse.json({ error: 'One or more groups are invalid.' }, { status: 400 })
    }
  }

  const userId = randomUUID()
  const passwordHash = await hashPassword(password)

  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO users (id, name, nickname, email, phone, password_hash, role, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`
    ).run(
      userId,
      name,
      nickname || null,
      normalizedEmail,
      phone || null,
      passwordHash,
      role,
    )

    db.prepare(`INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, 'group-default')`).run(userId)

    for (const groupId of uniqueGroupIds) {
      db.prepare('INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, ?)').run(userId, groupId)
    }
  })

  tx()

  logAudit({
    action: 'user.created',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: userId,
    targetType: 'user',
    metadata: { email: normalizedEmail, role, groupIds: uniqueGroupIds },
    ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  const user = db.prepare(
    `SELECT id, name, nickname, email, phone, role, status, created_at, updated_at
     FROM users WHERE id = ?`
  ).get(userId) as UserRow

  return NextResponse.json({ user }, { status: 201 })
}

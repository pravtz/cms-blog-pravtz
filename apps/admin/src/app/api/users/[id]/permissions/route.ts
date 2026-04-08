import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { getUserPermissionOverrides, ALL_RESOURCES, ALL_OPERATIONS } from '@/lib/rbac'
import type { Resource, Operation } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const user = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(params.id) as { id: string; name: string; email: string; role: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  const overrides = getUserPermissionOverrides(db, params.id)
  return NextResponse.json({ user, overrides })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const user = db
    .prepare('SELECT id, name, email, role FROM users WHERE id = ?')
    .get(params.id) as { id: string; name: string; email: string; role: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  if (user.role === 'owner') {
    return NextResponse.json(
      { error: 'Owner permissions cannot be overridden.' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { overrides } = body as {
    overrides: Partial<Record<Resource, Partial<Record<Operation, boolean | null>>>>
  }

  if (!overrides || typeof overrides !== 'object') {
    return NextResponse.json({ error: 'overrides object is required.' }, { status: 400 })
  }

  const updateOverrides = db.transaction(() => {
    db.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(params.id)
    const insert = db.prepare(
      'INSERT INTO user_permissions (user_id, resource, operation, allowed) VALUES (?, ?, ?, ?)'
    )
    for (const resource of ALL_RESOURCES) {
      for (const operation of ALL_OPERATIONS) {
        const val = overrides[resource]?.[operation]
        if (val !== undefined && val !== null) {
          insert.run(params.id, resource, operation, val ? 1 : 0)
        }
      }
    }
  })
  updateOverrides()

  const updated = getUserPermissionOverrides(db, params.id)
  return NextResponse.json({ user, overrides: updated })
}

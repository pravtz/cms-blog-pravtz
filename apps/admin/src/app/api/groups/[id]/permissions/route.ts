import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { getGroupPermissions, ALL_RESOURCES, ALL_OPERATIONS } from '@/lib/rbac'
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
  const group = db.prepare('SELECT id, name, is_system FROM groups WHERE id = ?').get(params.id) as
    | { id: string; name: string; is_system: number }
    | undefined

  if (!group) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
  }

  const permissions = getGroupPermissions(db, params.id)
  return NextResponse.json({ group, permissions })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const group = db.prepare('SELECT id, name, is_system FROM groups WHERE id = ?').get(params.id) as
    | { id: string; name: string; is_system: number }
    | undefined

  if (!group) {
    return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
  }

  // Owner group permissions cannot be changed (owner bypasses RBAC)
  if (group.name === 'owner') {
    return NextResponse.json(
      { error: 'Owner group permissions cannot be modified.' },
      { status: 403 }
    )
  }

  const body = await request.json()
  const { permissions } = body as {
    permissions: Partial<Record<Resource, Partial<Record<Operation, boolean>>>>
  }

  if (!permissions || typeof permissions !== 'object') {
    return NextResponse.json({ error: 'permissions object is required.' }, { status: 400 })
  }

  const updatePermissions = db.transaction(() => {
    db.prepare('DELETE FROM group_permissions WHERE group_id = ?').run(params.id)
    const insert = db.prepare(
      'INSERT INTO group_permissions (group_id, resource, operation, allowed) VALUES (?, ?, ?, ?)'
    )
    for (const resource of ALL_RESOURCES) {
      for (const operation of ALL_OPERATIONS) {
        const val = permissions[resource]?.[operation]
        if (val !== undefined) {
          insert.run(params.id, resource, operation, val ? 1 : 0)
        }
      }
    }
  })
  updatePermissions()

  const updated = getGroupPermissions(db, params.id)
  return NextResponse.json({ group, permissions: updated })
}

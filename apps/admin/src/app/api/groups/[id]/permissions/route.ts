import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { getGroupPermissions, ALL_RESOURCES, ALL_OPERATIONS } from '@/lib/rbac'
import type { Resource, Operation } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Convert boolean-map permissions to granted-operations-array format:
 *   { posts: { read: true, write: true, delete: false, manage: false } }
 *   → { posts: ['read', 'write'], ... }
 *
 * This is the canonical format returned by the GET endpoint, matching what
 * the E2E tests expect when using `.toContain('read')`.
 */
function toArrayFormat(
  perms: Record<Resource, Record<Operation, boolean>>
): Record<Resource, Operation[]> {
  const result = {} as Record<Resource, Operation[]>
  for (const resource of ALL_RESOURCES) {
    result[resource] = ALL_OPERATIONS.filter((op) => perms[resource][op])
  }
  return result
}

/**
 * Normalize incoming permission payload — accepts BOTH formats:
 *   • Array format:  { posts: ['read', 'write'] }
 *   • Boolean map:   { posts: { read: true, write: false } }
 *
 * Always returns the boolean-map format used internally for persistence.
 */
function normalizeInput(
  raw: Partial<Record<Resource, Operation[] | Partial<Record<Operation, boolean>>>>
): Partial<Record<Resource, Partial<Record<Operation, boolean>>>> {
  const result: Partial<Record<Resource, Partial<Record<Operation, boolean>>>> = {}
  for (const resource of ALL_RESOURCES) {
    const val = raw[resource]
    if (val === undefined) continue
    if (Array.isArray(val)) {
      const boolMap: Partial<Record<Operation, boolean>> = {}
      for (const op of ALL_OPERATIONS) {
        boolMap[op] = val.includes(op)
      }
      result[resource] = boolMap
    } else {
      result[resource] = val as Partial<Record<Operation, boolean>>
    }
  }
  return result
}

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

  const rawPerms = getGroupPermissions(db, params.id)
  return NextResponse.json({ group, permissions: toArrayFormat(rawPerms) })
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
  const { permissions: rawPermissions } = body as {
    permissions: Partial<Record<Resource, Operation[] | Partial<Record<Operation, boolean>>>>
  }

  if (!rawPermissions || typeof rawPermissions !== 'object' || Array.isArray(rawPermissions)) {
    return NextResponse.json({ error: 'permissions object is required.' }, { status: 400 })
  }

  const permissions = normalizeInput(rawPermissions)

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

  logAudit({
    action: 'rbac.group_permissions_changed',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: params.id,
    targetType: 'group',
    metadata: { groupName: group.name },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ group, permissions: toArrayFormat(updated) })
}

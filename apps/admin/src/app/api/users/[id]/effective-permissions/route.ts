import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'
import { getEffectivePermissions } from '@/lib/rbac'

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

  const permissions = getEffectivePermissions(db, user.id, user.role)
  return NextResponse.json({ user, permissions })
}

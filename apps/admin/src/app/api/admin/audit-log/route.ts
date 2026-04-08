import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AuditRow {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  target_id: string | null
  target_type: string | null
  metadata: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const actorEmail = searchParams.get('actorEmail')
  const targetType = searchParams.get('targetType')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = 50
  const offset = (page - 1) * limit

  const db = getDb()

  const conditions: string[] = []
  const params: unknown[] = []

  if (action) {
    conditions.push('action = ?')
    params.push(action)
  }
  if (actorEmail) {
    conditions.push('actor_email LIKE ?')
    params.push(`%${actorEmail}%`)
  }
  if (targetType) {
    conditions.push('target_type = ?')
    params.push(targetType)
  }
  if (from) {
    conditions.push('created_at >= ?')
    params.push(from)
  }
  if (to) {
    conditions.push('created_at <= ?')
    params.push(to)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const rows = db
    .prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as AuditRow[]

  const total = (
    db
      .prepare(`SELECT COUNT(*) as n FROM audit_logs ${where}`)
      .get(...params) as { n: number }
  ).n

  const logs = rows.map((row) => ({
    ...row,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  }))

  return NextResponse.json({ logs, total, page, limit })
}

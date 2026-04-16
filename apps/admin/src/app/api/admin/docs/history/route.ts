import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/docs/history?page=1&limit=20
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit

  const db = getDb()

  const total = (
    db.prepare('SELECT COUNT(*) as count FROM doc_versions').get() as { count: number }
  ).count

  const versions = db
    .prepare(
      `SELECT d.id, d.content, d.change_summary, d.version, d.is_current, d.created_at,
              u.name as author_name, u.email as author_email
       FROM doc_versions d
       LEFT JOIN users u ON u.id = d.author_id
       ORDER BY d.version DESC
       LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as {
    id: string
    content: string
    change_summary: string | null
    version: number
    is_current: number
    created_at: string
    author_name: string
    author_email: string
  }[]

  return NextResponse.json({
    versions,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}

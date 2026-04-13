export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()

  const post = db.prepare('SELECT id, author_id FROM posts WHERE id = ?').get(params.id) as
    | { id: string; author_id: string }
    | undefined
  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Authors can view their own posts' versions; owners can view any
  const { payload } = auth
  if (payload.role !== 'owner' && post.author_id !== payload.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const versions = db
    .prepare(
      `SELECT pv.id, pv.version_number, pv.title, pv.status, pv.change_summary,
              pv.created_at, u.name as author_name
       FROM post_versions pv
       LEFT JOIN users u ON pv.created_by = u.id
       WHERE pv.post_id = ?
       ORDER BY pv.version_number DESC`
    )
    .all(params.id)

  return NextResponse.json({ versions })
}

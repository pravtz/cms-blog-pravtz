export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const { payload } = auth

  const post = db
    .prepare('SELECT id, author_id FROM posts WHERE id = ?')
    .get(params.id) as { id: string; author_id: string } | undefined
  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (payload.role !== 'owner' && post.author_id !== payload.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const version = db
    .prepare(
      `SELECT pv.*, u.name as author_name
       FROM post_versions pv
       LEFT JOIN users u ON pv.created_by = u.id
       WHERE pv.id = ? AND pv.post_id = ?`
    )
    .get(params.versionId, params.id)

  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  return NextResponse.json({ version })
}

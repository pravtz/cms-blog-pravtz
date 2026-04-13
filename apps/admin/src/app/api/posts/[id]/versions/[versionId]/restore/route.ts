export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb, createVersionSnapshot } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; versionId: string } }
) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const { payload } = auth

  const post = db
    .prepare('SELECT id, author_id, status FROM posts WHERE id = ?')
    .get(params.id) as { id: string; author_id: string; status: string } | undefined
  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (payload.role !== 'owner' && post.author_id !== payload.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const version = db
    .prepare('SELECT * FROM post_versions WHERE id = ? AND post_id = ?')
    .get(params.versionId, params.id) as Record<string, unknown> | undefined
  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  // Snapshot current state before restoring
  try {
    createVersionSnapshot(params.id, payload.sub, `Before restore to v${version.version_number}`)
  } catch {
    // Non-fatal
  }

  // Restore: update post fields from the version snapshot
  db.prepare(
    `UPDATE posts SET
       title = ?, subtitle = ?, excerpt = ?, content = ?,
       status = ?, visibility = ?, language = ?, category_id = ?,
       cover_image = ?, seo_title = ?, seo_description = ?, publish_date = ?,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    version.title,
    version.subtitle,
    version.excerpt,
    version.content,
    version.status,
    version.visibility,
    version.language,
    version.category_id,
    version.cover_image,
    version.seo_title,
    version.seo_description,
    version.publish_date,
    params.id
  )

  logAudit({
    action: 'post.restored',
    actorId: payload.sub,
    actorEmail: payload.email,
    targetId: params.id,
    targetType: 'post',
    metadata: { versionId: params.versionId, versionNumber: version.version_number },
    ipAddress:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}

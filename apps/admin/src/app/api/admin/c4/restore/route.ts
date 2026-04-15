import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/c4/restore — restore a specific version (creates new current from old source)
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { payload } = authResult
  if (payload.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  }

  let body: { versionId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { versionId } = body
  if (!versionId) {
    return NextResponse.json({ error: 'versionId required' }, { status: 400 })
  }

  const db = getDb()

  const version = db
    .prepare('SELECT id, level, source FROM c4_diagrams WHERE id = ?')
    .get(versionId) as { id: string; level: string; source: string } | undefined

  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  const maxRow = db
    .prepare('SELECT MAX(version) as max_version FROM c4_diagrams WHERE level = ?')
    .get(version.level) as { max_version: number | null }

  const nextVersion = (maxRow.max_version ?? 0) + 1
  const id = uuidv4()
  const now = new Date().toISOString()

  db.transaction(() => {
    db.prepare('UPDATE c4_diagrams SET is_current = 0 WHERE level = ?').run(version.level)
    db.prepare(
      'INSERT INTO c4_diagrams (id, level, source, author_id, version, is_current, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(id, version.level, version.source, payload.sub, nextVersion, now)
  })()

  return NextResponse.json({ id, level: version.level, source: version.source, version: nextVersion, created_at: now })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { resolvePermission } from '@/lib/rbac'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/docs/restore — restore a previous version as a new current version
export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { payload } = authResult
  const db = getDb()

  const canEdit =
    payload.role === 'owner' ||
    resolvePermission(db, payload.sub, payload.role, 'settings', 'write')

  if (!canEdit) {
    return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  }

  let body: { versionId: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { versionId } = body
  if (!versionId) {
    return NextResponse.json({ error: 'versionId is required' }, { status: 400 })
  }

  const target = db
    .prepare('SELECT id, content, change_summary FROM doc_versions WHERE id = ?')
    .get(versionId) as { id: string; content: string; change_summary: string | null } | undefined

  if (!target) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 })
  }

  const maxRow = db
    .prepare('SELECT MAX(version) as max_version FROM doc_versions')
    .get() as { max_version: number | null }

  const nextVersion = (maxRow.max_version ?? 0) + 1
  const id = uuidv4()
  const now = new Date().toISOString()
  const changeSummary = `Restored from v${(db.prepare('SELECT version FROM doc_versions WHERE id = ?').get(versionId) as { version: number }).version}`

  db.transaction(() => {
    db.prepare('UPDATE doc_versions SET is_current = 0').run()
    db.prepare(
      'INSERT INTO doc_versions (id, content, change_summary, author_id, version, is_current, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(id, target.content, changeSummary, payload.sub, nextVersion, now)
  })()

  return NextResponse.json({ id, content: target.content, change_summary: changeSummary, version: nextVersion, created_at: now })
}

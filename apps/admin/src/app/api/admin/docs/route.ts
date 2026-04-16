import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { resolvePermission } from '@/lib/rbac'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/docs — return current doc version
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const db = getDb()
  const doc = db
    .prepare(
      'SELECT id, content, change_summary, author_id, version, created_at FROM doc_versions WHERE is_current = 1'
    )
    .get() as {
    id: string
    content: string
    change_summary: string | null
    author_id: string
    version: number
    created_at: string
  } | undefined

  return NextResponse.json({ doc: doc ?? null })
}

// PUT /api/admin/docs — save a new version (requires settings:write or owner)
export async function PUT(request: NextRequest) {
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

  let body: { content: string; change_summary?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content, change_summary } = body

  if (typeof content !== 'string') {
    return NextResponse.json({ error: 'content must be a string' }, { status: 400 })
  }

  const maxRow = db
    .prepare('SELECT MAX(version) as max_version FROM doc_versions')
    .get() as { max_version: number | null }

  const nextVersion = (maxRow.max_version ?? 0) + 1
  const id = uuidv4()
  const now = new Date().toISOString()

  db.transaction(() => {
    db.prepare('UPDATE doc_versions SET is_current = 0').run()
    db.prepare(
      'INSERT INTO doc_versions (id, content, change_summary, author_id, version, is_current, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(id, content, change_summary ?? null, payload.sub, nextVersion, now)
  })()

  return NextResponse.json({ id, content, change_summary: change_summary ?? null, version: nextVersion, created_at: now })
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VALID_LEVELS = ['context', 'container', 'component'] as const
type DiagramLevel = (typeof VALID_LEVELS)[number]

// GET /api/admin/c4?level=context
export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { searchParams } = new URL(request.url)
  const level = searchParams.get('level') as DiagramLevel | null

  const db = getDb()

  if (level) {
    if (!VALID_LEVELS.includes(level)) {
      return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
    }

    const diagram = db
      .prepare(
        'SELECT id, level, source, author_id, version, created_at FROM c4_diagrams WHERE level = ? AND is_current = 1'
      )
      .get(level) as {
      id: string
      level: string
      source: string
      author_id: string
      version: number
      created_at: string
    } | undefined

    return NextResponse.json({ diagram: diagram ?? null })
  }

  // Return all current diagrams
  const diagrams = db
    .prepare(
      'SELECT id, level, source, author_id, version, created_at FROM c4_diagrams WHERE is_current = 1 ORDER BY level'
    )
    .all() as {
    id: string
    level: string
    source: string
    author_id: string
    version: number
    created_at: string
  }[]

  return NextResponse.json({ diagrams })
}

// PUT /api/admin/c4 — save a new version for a level
export async function PUT(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const { payload } = authResult
  if (payload.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  }

  let body: { level: string; source: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { level, source } = body

  if (!level || !VALID_LEVELS.includes(level as DiagramLevel)) {
    return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
  }

  if (typeof source !== 'string') {
    return NextResponse.json({ error: 'source must be a string' }, { status: 400 })
  }

  const db = getDb()

  // Get current max version for this level
  const maxRow = db
    .prepare('SELECT MAX(version) as max_version FROM c4_diagrams WHERE level = ?')
    .get(level) as { max_version: number | null }

  const nextVersion = (maxRow.max_version ?? 0) + 1
  const id = uuidv4()
  const now = new Date().toISOString()

  db.transaction(() => {
    // Mark all previous versions as not current
    db.prepare('UPDATE c4_diagrams SET is_current = 0 WHERE level = ?').run(level)

    // Insert new version
    db.prepare(
      'INSERT INTO c4_diagrams (id, level, source, author_id, version, is_current, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    ).run(id, level, source, payload.sub, nextVersion, now)
  })()

  return NextResponse.json({ id, level, source, version: nextVersion, created_at: now })
}

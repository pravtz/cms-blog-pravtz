import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Release {
  id: string
  version: string
  release_date: string
  type: string
  changelog: string
  commit_url: string | null
  pr_url: string | null
  is_current: number
  created_by: string
  created_at: string
  updated_at: string
  author_name: string
  author_email: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { payload } = authResult

  if (payload.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  }

  const db = getDb()
  const existing = db.prepare('SELECT * FROM releases WHERE id = ?').get(params.id) as Release | undefined
  if (!existing) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 })
  }

  const body = await request.json()
  const { version, release_date, type, changelog, commit_url, pr_url, is_current } = body

  if (!version || !release_date || !changelog) {
    return NextResponse.json({ error: 'version, release_date, and changelog are required' }, { status: 400 })
  }

  const validTypes = ['major', 'minor', 'patch']
  if (type && !validTypes.includes(type)) {
    return NextResponse.json({ error: 'type must be major, minor, or patch' }, { status: 400 })
  }

  // Check for duplicate version (other than self)
  const dup = db.prepare('SELECT id FROM releases WHERE version = ? AND id != ?').get(version, params.id)
  if (dup) {
    return NextResponse.json({ error: 'A release with this version already exists' }, { status: 409 })
  }

  db.transaction(() => {
    if (is_current) {
      db.prepare('UPDATE releases SET is_current = 0').run()
    }

    db.prepare(
      `UPDATE releases SET
         version = ?, release_date = ?, type = ?, changelog = ?,
         commit_url = ?, pr_url = ?, is_current = ?,
         updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      version,
      release_date,
      type ?? existing.type,
      changelog,
      commit_url ?? null,
      pr_url ?? null,
      is_current ? 1 : 0,
      params.id,
    )
  })()

  const updated = db
    .prepare(
      `SELECT r.*, u.name as author_name, u.email as author_email
       FROM releases r LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = ?`
    )
    .get(params.id) as Release

  return NextResponse.json(updated)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { payload } = authResult

  if (payload.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
  }

  const db = getDb()
  const existing = db.prepare('SELECT id FROM releases WHERE id = ?').get(params.id)
  if (!existing) {
    return NextResponse.json({ error: 'Release not found' }, { status: 404 })
  }

  db.prepare('DELETE FROM releases WHERE id = ?').run(params.id)
  return NextResponse.json({ success: true })
}

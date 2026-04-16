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

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const db = getDb()
  const releases = db
    .prepare(
      `SELECT r.*, u.name as author_name, u.email as author_email
       FROM releases r
       LEFT JOIN users u ON r.created_by = u.id
       ORDER BY r.release_date DESC, r.created_at DESC`
    )
    .all() as Release[]

  return NextResponse.json({ releases })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { payload } = authResult

  if (payload.role !== 'owner') {
    return NextResponse.json({ error: 'Owner only' }, { status: 403 })
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

  const db = getDb()

  // Check for duplicate version
  const existing = db.prepare('SELECT id FROM releases WHERE version = ?').get(version)
  if (existing) {
    return NextResponse.json({ error: 'A release with this version already exists' }, { status: 409 })
  }

  const id = require('crypto').randomUUID()

  db.transaction(() => {
    // If marking as current, unset all others
    if (is_current) {
      db.prepare('UPDATE releases SET is_current = 0').run()
    }

    db.prepare(
      `INSERT INTO releases (id, version, release_date, type, changelog, commit_url, pr_url, is_current, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      version,
      release_date,
      type ?? 'patch',
      changelog,
      commit_url ?? null,
      pr_url ?? null,
      is_current ? 1 : 0,
      payload.sub,
    )
  })()

  const release = db
    .prepare(
      `SELECT r.*, u.name as author_name, u.email as author_email
       FROM releases r LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = ?`
    )
    .get(id) as Release

  return NextResponse.json(release, { status: 201 })
}

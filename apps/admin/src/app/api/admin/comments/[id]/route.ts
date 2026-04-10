export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const { id } = await context.params
  const body = await request.json()
  const { status } = body

  if (!['visible', 'hidden', 'flagged'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status.' }, { status: 400 })
  }

  const db = getDb()
  const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(id)
  if (!comment) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })

  db.prepare(
    "UPDATE comments SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, id)

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const { id } = await context.params
  const db = getDb()

  const comment = db.prepare('SELECT id FROM comments WHERE id = ?').get(id)
  if (!comment) return NextResponse.json({ error: 'Comment not found.' }, { status: 404 })

  db.prepare('DELETE FROM comments WHERE id = ?').run(id)

  return NextResponse.json({ success: true })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { id } = await context.params
  const db = getDb()

  const notification = db.prepare(
    'SELECT id FROM notifications WHERE id = ? AND user_id = ?'
  ).get(id, auth.payload.sub)

  if (!notification) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id)

  return NextResponse.json({ success: true })
}

// Mark all notifications as read
export async function DELETE(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(auth.payload.sub)

  return NextResponse.json({ success: true })
}

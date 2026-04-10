export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401, headers: CORS_HEADERS })
  }

  const { id } = await context.params
  const db = getDb()

  const comment = db.prepare(
    "SELECT id FROM comments WHERE id = ? AND status = 'visible'"
  ).get(id)

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found.' }, { status: 404, headers: CORS_HEADERS })
  }

  db.prepare(
    "UPDATE comments SET status = 'flagged', updated_at = datetime('now') WHERE id = ?"
  ).run(id)

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS })
}

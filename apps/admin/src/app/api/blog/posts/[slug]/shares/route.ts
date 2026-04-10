export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getDb } from '@/lib/db'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const VALID_CHANNELS = new Set(['whatsapp', 'linkedin', 'instagram', 'clipboard'])

function getUserIdFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  try {
    const payload = jwt.verify(token, secret) as { sub: string; type?: string }
    if (payload.type === 'refresh') return null
    return payload.sub
  } catch {
    return null
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const db = getDb()
  const post = db
    .prepare("SELECT id FROM posts WHERE slug = ? AND status = 'published' AND visibility != 'iPrivate'")
    .get(params.slug) as { id: string } | undefined

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS })
  }

  const { shareCount } = db
    .prepare('SELECT COUNT(*) AS shareCount FROM post_shares WHERE post_id = ?')
    .get(post.id) as { shareCount: number }

  return NextResponse.json({ shareCount }, { headers: CORS_HEADERS })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const userId = getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  let body: { channel?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400, headers: CORS_HEADERS })
  }

  const channel = body.channel
  if (!channel || !VALID_CHANNELS.has(channel)) {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400, headers: CORS_HEADERS })
  }

  const db = getDb()
  const post = db
    .prepare("SELECT id FROM posts WHERE slug = ? AND status = 'published' AND visibility != 'iPrivate'")
    .get(params.slug) as { id: string } | undefined

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS })
  }

  // Anti-spam: 1 registration per user per post per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recent = db
    .prepare(
      "SELECT 1 FROM post_shares WHERE post_id = ? AND user_id = ? AND created_at > ?"
    )
    .get(post.id, userId, oneHourAgo)

  if (!recent) {
    db.prepare(
      'INSERT INTO post_shares (post_id, user_id, channel) VALUES (?, ?, ?)'
    ).run(post.id, userId, channel)
  }

  const { shareCount } = db
    .prepare('SELECT COUNT(*) AS shareCount FROM post_shares WHERE post_id = ?')
    .get(post.id) as { shareCount: number }

  return NextResponse.json({ shareCount }, { headers: CORS_HEADERS })
}

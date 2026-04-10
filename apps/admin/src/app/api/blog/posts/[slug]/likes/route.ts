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
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const db = getDb()
  const post = db
    .prepare("SELECT id FROM posts WHERE slug = ? AND status = 'published' AND visibility != 'iPrivate'")
    .get(params.slug) as { id: string } | undefined

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS })
  }

  const { likeCount } = db
    .prepare('SELECT COUNT(*) AS likeCount FROM post_likes WHERE post_id = ?')
    .get(post.id) as { likeCount: number }

  const userId = getUserIdFromRequest(request)
  let userLiked = false
  if (userId) {
    const row = db
      .prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?')
      .get(post.id, userId)
    userLiked = !!row
  }

  return NextResponse.json({ likeCount, userLiked }, { headers: CORS_HEADERS })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const userId = getUserIdFromRequest(request)
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS })
  }

  const db = getDb()
  const post = db
    .prepare("SELECT id FROM posts WHERE slug = ? AND status = 'published' AND visibility != 'iPrivate'")
    .get(params.slug) as { id: string } | undefined

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: CORS_HEADERS })
  }

  // Toggle like
  const existing = db
    .prepare('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?')
    .get(post.id, userId)

  if (existing) {
    db.prepare('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?').run(post.id, userId)
  } else {
    db.prepare('INSERT OR IGNORE INTO post_likes (post_id, user_id) VALUES (?, ?)').run(post.id, userId)
  }

  const { likeCount } = db
    .prepare('SELECT COUNT(*) AS likeCount FROM post_likes WHERE post_id = ?')
    .get(post.id) as { likeCount: number }

  return NextResponse.json(
    { likeCount, userLiked: !existing },
    { headers: CORS_HEADERS }
  )
}

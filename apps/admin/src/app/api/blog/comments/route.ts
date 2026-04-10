export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { randomUUID } from 'crypto'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

interface CommentRow {
  id: string
  post_id: string
  parent_id: string | null
  author_id: string
  author_name: string
  content: string
  status: string
  upvotes: number
  downvotes: number
  created_at: string
  user_vote: number | null
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('postId')

  if (!postId) {
    return NextResponse.json({ error: 'postId is required.' }, { status: 400, headers: CORS_HEADERS })
  }

  // Determine current user id if auth token provided (optional)
  let currentUserId: string | null = null
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const jwt = await import('jsonwebtoken')
      const secret = process.env.JWT_SECRET
      if (secret) {
        const payload = jwt.default.verify(authHeader.slice(7), secret) as { sub: string }
        currentUserId = payload.sub
      }
    } catch { /* unauthenticated */ }
  }

  const db = getDb()

  // Get top-level comments (no parent)
  const topLevel = db.prepare(`
    SELECT
      c.id, c.post_id, c.parent_id, c.author_id, c.content, c.status,
      c.upvotes, c.downvotes, c.created_at,
      u.name AS author_name,
      ${currentUserId ? 'cv.vote AS user_vote' : 'NULL AS user_vote'}
    FROM comments c
    JOIN users u ON u.id = c.author_id
    ${currentUserId ? 'LEFT JOIN comment_votes cv ON cv.comment_id = c.id AND cv.user_id = ?' : ''}
    WHERE c.post_id = ? AND c.parent_id IS NULL AND c.status = 'visible'
    ORDER BY c.created_at ASC
  `).all(...(currentUserId ? [currentUserId, postId] : [postId])) as CommentRow[]

  // Get all replies for this post
  const replies = db.prepare(`
    SELECT
      c.id, c.post_id, c.parent_id, c.author_id, c.content, c.status,
      c.upvotes, c.downvotes, c.created_at,
      u.name AS author_name,
      ${currentUserId ? 'cv.vote AS user_vote' : 'NULL AS user_vote'}
    FROM comments c
    JOIN users u ON u.id = c.author_id
    ${currentUserId ? 'LEFT JOIN comment_votes cv ON cv.comment_id = c.id AND cv.user_id = ?' : ''}
    WHERE c.post_id = ? AND c.parent_id IS NOT NULL AND c.status = 'visible'
    ORDER BY c.created_at ASC
  `).all(...(currentUserId ? [currentUserId, postId] : [postId])) as CommentRow[]

  // Group replies by parent
  const repliesByParent: Record<string, CommentRow[]> = {}
  for (const r of replies) {
    if (r.parent_id) {
      if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = []
      repliesByParent[r.parent_id].push(r)
    }
  }

  const threads = topLevel.map((c) => ({
    ...c,
    replies: repliesByParent[c.id] ?? [],
  }))

  return NextResponse.json({ comments: threads }, { headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return NextResponse.json({ error: auth.statusText || 'Authentication required.' }, { status: 401, headers: CORS_HEADERS })

  let body: { postId?: string; parentId?: string; content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers: CORS_HEADERS })
  }

  const { postId, parentId, content } = body

  if (!postId || !content?.trim()) {
    return NextResponse.json({ error: 'postId and content are required.' }, { status: 400, headers: CORS_HEADERS })
  }

  if (content.length > 2000) {
    return NextResponse.json({ error: 'Content exceeds 2000 characters.' }, { status: 400, headers: CORS_HEADERS })
  }

  const db = getDb()

  // Check post exists and is public
  const post = db.prepare(
    "SELECT id, author_id, title, slug FROM posts WHERE id = ? AND status = 'published'"
  ).get(postId) as { id: string; author_id: string; title: string; slug: string } | undefined

  if (!post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404, headers: CORS_HEADERS })
  }

  // If reply, validate parent exists and is top-level (1 level deep only)
  if (parentId) {
    const parent = db.prepare(
      'SELECT id, parent_id FROM comments WHERE id = ? AND post_id = ?'
    ).get(parentId, postId) as { id: string; parent_id: string | null } | undefined

    if (!parent) {
      return NextResponse.json({ error: 'Parent comment not found.' }, { status: 404, headers: CORS_HEADERS })
    }
    if (parent.parent_id) {
      return NextResponse.json({ error: 'Nested replies beyond 1 level are not supported.' }, { status: 400, headers: CORS_HEADERS })
    }
  }

  const id = randomUUID()
  db.prepare(`
    INSERT INTO comments (id, post_id, parent_id, author_id, content, status)
    VALUES (?, ?, ?, ?, ?, 'visible')
  `).run(id, postId, parentId ?? null, auth.payload.sub, content.trim())

  // Send notifications
  const authorId = auth.payload.sub

  if (parentId) {
    // Notify the parent comment's author (if different from commenter)
    const parentComment = db.prepare(
      'SELECT author_id FROM comments WHERE id = ?'
    ).get(parentId) as { author_id: string } | undefined

    if (parentComment && parentComment.author_id !== authorId) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, 'new_reply', 'New reply to your comment', ?, ?)
      `).run(
        randomUUID(),
        parentComment.author_id,
        `Someone replied to your comment on "${post.title}"`,
        `/blog/${post.slug}#comment-${id}`
      )
    }
  } else {
    // Notify the post author (if different from commenter)
    if (post.author_id !== authorId) {
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, link)
        VALUES (?, ?, 'new_comment', 'New comment on your post', ?, ?)
      `).run(
        randomUUID(),
        post.author_id,
        `Someone commented on "${post.title}"`,
        `/blog/${post.slug}#comment-${id}`
      )
    }
  }

  const newComment = db.prepare(`
    SELECT c.id, c.post_id, c.parent_id, c.author_id, c.content, c.status,
           c.upvotes, c.downvotes, c.created_at, u.name AS author_name
    FROM comments c JOIN users u ON u.id = c.author_id
    WHERE c.id = ?
  `).get(id) as CommentRow

  return NextResponse.json({ comment: newComment }, { status: 201, headers: CORS_HEADERS })
}

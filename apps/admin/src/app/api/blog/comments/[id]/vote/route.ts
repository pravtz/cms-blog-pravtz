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

  let body: { vote?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers: CORS_HEADERS })
  }

  const { vote } = body
  if (vote !== 1 && vote !== -1) {
    return NextResponse.json({ error: 'vote must be 1 or -1.' }, { status: 400, headers: CORS_HEADERS })
  }

  const db = getDb()
  const comment = db.prepare(
    "SELECT id, upvotes, downvotes FROM comments WHERE id = ? AND status = 'visible'"
  ).get(id) as { id: string; upvotes: number; downvotes: number } | undefined

  if (!comment) {
    return NextResponse.json({ error: 'Comment not found.' }, { status: 404, headers: CORS_HEADERS })
  }

  const userId = auth.payload.sub

  const existing = db.prepare(
    'SELECT vote FROM comment_votes WHERE comment_id = ? AND user_id = ?'
  ).get(id, userId) as { vote: number } | undefined

  const updateVoteCounts = db.transaction((oldVote: number | null, newVote: number | null) => {
    let upvotesDelta = 0
    let downvotesDelta = 0

    if (oldVote === 1) upvotesDelta -= 1
    if (oldVote === -1) downvotesDelta -= 1

    if (newVote === 1) upvotesDelta += 1
    if (newVote === -1) downvotesDelta += 1

    if (newVote === null) {
      db.prepare('DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?').run(id, userId)
    } else {
      db.prepare(`
        INSERT INTO comment_votes (comment_id, user_id, vote) VALUES (?, ?, ?)
        ON CONFLICT(comment_id, user_id) DO UPDATE SET vote = excluded.vote
      `).run(id, userId, newVote)
    }

    db.prepare(`
      UPDATE comments SET upvotes = upvotes + ?, downvotes = downvotes + ? WHERE id = ?
    `).run(upvotesDelta, downvotesDelta, id)
  })

  // Toggle: if same vote exists, remove it; otherwise set/update
  const currentVote = existing?.vote ?? null
  const newVote = currentVote === vote ? null : vote

  updateVoteCounts(currentVote, newVote)

  const updated = db.prepare(
    'SELECT upvotes, downvotes FROM comments WHERE id = ?'
  ).get(id) as { upvotes: number; downvotes: number }

  return NextResponse.json(
    { upvotes: updated.upvotes, downvotes: updated.downvotes, userVote: newVote },
    { headers: CORS_HEADERS }
  )
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

interface CommentRow {
  id: string
  post_id: string
  post_title: string
  post_slug: string
  parent_id: string | null
  author_id: string
  author_name: string
  author_email: string
  content: string
  status: string
  upvotes: number
  downvotes: number
  created_at: string
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const db = getDb()

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (status && ['visible', 'hidden', 'flagged'].includes(status)) {
    conditions.push('c.status = ?')
    params.push(status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const comments = db.prepare(`
    SELECT
      c.id, c.post_id, c.parent_id, c.author_id, c.content, c.status,
      c.upvotes, c.downvotes, c.created_at,
      p.title AS post_title, p.slug AS post_slug,
      u.name AS author_name, u.email AS author_email
    FROM comments c
    JOIN posts p ON p.id = c.post_id
    JOIN users u ON u.id = c.author_id
    ${where}
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all([...params, limit, offset]) as CommentRow[]

  const total = (db.prepare(`
    SELECT COUNT(*) AS count FROM comments c ${where}
  `).get(params) as { count: number }).count

  return NextResponse.json({ comments, total, page, limit })
}

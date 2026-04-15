export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

interface IdeaRow {
  id: string
  title: string
  description: string | null
  rating: number
  created_by: string
  created_by_name: string
  shared_with: string
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const minRating = parseInt(searchParams.get('min_rating') ?? '0', 10)
  const sharedFilter = searchParams.get('shared') // 'yes' | 'no' | null
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  const db = getDb()
  const userId = auth.payload.sub

  // Fetch all and filter in JS — SQLite JSON function availability varies
  const allIdeas = db
    .prepare(
      `SELECT i.*, u.name as created_by_name
       FROM ideas i
       JOIN users u ON u.id = i.created_by
       ORDER BY i.rating DESC, i.created_at DESC`
    )
    .all() as IdeaRow[]

  // Filter in JS for shared_with (more reliable than SQLite JSON)
  let filtered = allIdeas.filter((idea) => {
    if (idea.created_by === userId) return true
    try {
      const sharedWith: string[] = JSON.parse(idea.shared_with)
      return sharedWith.includes(userId)
    } catch {
      return false
    }
  })

  if (minRating > 0) {
    filtered = filtered.filter((i) => i.rating >= minRating)
  }

  if (sharedFilter === 'yes') {
    filtered = filtered.filter((i) => {
      try {
        return JSON.parse(i.shared_with).length > 0
      } catch {
        return false
      }
    })
  } else if (sharedFilter === 'no') {
    filtered = filtered.filter((i) => {
      try {
        return JSON.parse(i.shared_with).length === 0
      } catch {
        return true
      }
    })
  }

  const total = filtered.length
  const paginated = filtered.slice(offset, offset + limit)

  return NextResponse.json({
    data: paginated,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { title, description, rating, shared_with } = body

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const ratingNum = typeof rating === 'number' ? Math.round(rating) : 0
  if (ratingNum < 0 || ratingNum > 10) {
    return NextResponse.json({ error: 'Rating must be 0–10' }, { status: 400 })
  }

  const sharedWith: string[] = Array.isArray(shared_with) ? shared_with : []

  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO ideas (id, title, description, rating, created_by, shared_with, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    title.trim(),
    description?.trim() || null,
    ratingNum,
    auth.payload.sub,
    JSON.stringify(sharedWith),
    now,
    now
  )

  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id)
  return NextResponse.json({ idea }, { status: 201 })
}

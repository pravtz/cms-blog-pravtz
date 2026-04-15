export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

interface IdeaRow {
  id: string
  title: string
  description: string | null
  rating: number
  created_by: string
  shared_with: string
  created_at: string
  updated_at: string
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(params.id) as IdeaRow | undefined

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (idea.created_by !== auth.payload.sub && auth.payload.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const { title, description, rating, shared_with } = body

  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
  }

  const newTitle = title?.trim() ?? idea.title
  const newDescription = description !== undefined ? (description?.trim() || null) : idea.description
  const newRating = rating !== undefined ? Math.round(Number(rating)) : idea.rating
  if (newRating < 0 || newRating > 10) {
    return NextResponse.json({ error: 'Rating must be 0–10' }, { status: 400 })
  }
  const newSharedWith = Array.isArray(shared_with) ? JSON.stringify(shared_with) : idea.shared_with
  const now = new Date().toISOString()

  db.prepare(
    `UPDATE ideas SET title = ?, description = ?, rating = ?, shared_with = ?, updated_at = ? WHERE id = ?`
  ).run(newTitle, newDescription, newRating, newSharedWith, now, params.id)

  const updated = db.prepare('SELECT * FROM ideas WHERE id = ?').get(params.id)
  return NextResponse.json({ idea: updated })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(params.id) as IdeaRow | undefined

  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (idea.created_by !== auth.payload.sub && auth.payload.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  db.prepare('DELETE FROM ideas WHERE id = ?').run(params.id)
  return NextResponse.json({ success: true })
}

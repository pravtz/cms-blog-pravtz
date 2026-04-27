export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

interface CategoryRow {
  id: string
  name: string
  slug: string
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
})

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const { id } = params
  const db = getDb()

  const existing = db
    .prepare('SELECT id FROM categories WHERE id = ?')
    .get(id) as CategoryRow | undefined

  if (!existing) {
    return NextResponse.json({ error: 'Category not found.' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name } = parsed.data
  const slug = toSlug(name)

  const conflict = db
    .prepare('SELECT id FROM categories WHERE slug = ? AND id != ?')
    .get(slug, id) as { id: string } | undefined

  if (conflict) {
    return NextResponse.json(
      { error: 'A category with this name already exists.' },
      { status: 409 }
    )
  }

  db.prepare('UPDATE categories SET name = ?, slug = ? WHERE id = ?').run(
    name,
    slug,
    id
  )

  const category = db
    .prepare('SELECT id, name, slug FROM categories WHERE id = ?')
    .get(id) as CategoryRow

  return NextResponse.json({ category })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const { id } = params
  const db = getDb()

  const existing = db
    .prepare('SELECT id, name FROM categories WHERE id = ?')
    .get(id) as CategoryRow | undefined

  if (!existing) {
    return NextResponse.json({ error: 'Category not found.' }, { status: 404 })
  }

  db.prepare('UPDATE posts SET category_id = NULL WHERE category_id = ?').run(id)
  db.prepare('DELETE FROM categories WHERE id = ?').run(id)

  return NextResponse.json({ success: true })
}

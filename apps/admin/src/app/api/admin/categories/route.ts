export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

interface CategoryRow {
  id: string
  name: string
  slug: string
  created_at: string
  post_count: number
}

const createSchema = z.object({
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

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'owner', 'admin', 'editor')
  if (auth instanceof NextResponse) return auth

  const db = getDb()

  const categories = db
    .prepare(
      `SELECT c.id, c.name, c.slug, c.created_at,
          COUNT(p.id) AS post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name ASC`
    )
    .all() as CategoryRow[]

  return NextResponse.json({ categories })
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { name } = parsed.data
  const slug = toSlug(name)
  const id = uuidv4()
  const db = getDb()

  const existing = db
    .prepare('SELECT id FROM categories WHERE slug = ?')
    .get(slug) as { id: string } | undefined

  if (existing) {
    return NextResponse.json(
      { error: 'A category with this name already exists.' },
      { status: 409 }
    )
  }

  db.prepare(
    'INSERT INTO categories (id, name, slug, created_at) VALUES (?, ?, ?, datetime("now"))'
  ).run(id, name, slug)

  const category = db
    .prepare('SELECT id, name, slug, created_at FROM categories WHERE id = ?')
    .get(id) as CategoryRow

  return NextResponse.json({ category }, { status: 201 })
}

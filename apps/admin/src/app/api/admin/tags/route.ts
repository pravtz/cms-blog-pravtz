export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

interface TagRow {
  id: string
  name: string
  slug: string
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

  const tags = db
    .prepare(
      `SELECT t.id, t.name, t.slug,
          COUNT(DISTINCT pt.post_id) AS post_count
       FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id = t.id
       GROUP BY t.id
       ORDER BY t.name ASC`
    )
    .all() as TagRow[]

  return NextResponse.json({ tags })
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
    .prepare('SELECT id FROM tags WHERE slug = ?')
    .get(slug) as { id: string } | undefined

  if (existing) {
    return NextResponse.json(
      { error: 'A tag with this name already exists.' },
      { status: 409 }
    )
  }

  db.prepare(
    'INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)'
  ).run(id, name, slug)

  const tag = db
    .prepare('SELECT id, name, slug FROM tags WHERE id = ?')
    .get(id) as TagRow

  return NextResponse.json({ tag }, { status: 201 })
}

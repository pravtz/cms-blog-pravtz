export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const categories = db
    .prepare('SELECT id, name, slug FROM categories ORDER BY name ASC')
    .all()

  return NextResponse.json({ categories })
}

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const parsed = CreateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { name } = parsed.data
  const slug = slugify(name)
  const id = uuidv4()
  const db = getDb()

  try {
    db.prepare(
      'INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)'
    ).run(id, name, slug)
  } catch {
    return NextResponse.json(
      { error: 'Category already exists' },
      { status: 409 }
    )
  }

  return NextResponse.json({ category: { id, name, slug } }, { status: 201 })
}

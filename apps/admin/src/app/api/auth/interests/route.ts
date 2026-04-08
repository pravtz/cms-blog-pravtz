import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const InterestsSchema = z.object({
  categoryIds: z.array(z.string().uuid()).min(1, 'Select at least one category.'),
})

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()

  const categories = db
    .prepare('SELECT id, name, slug FROM categories ORDER BY name ASC')
    .all() as { id: string; name: string; slug: string }[]

  const userInterests = db
    .prepare('SELECT category_id FROM user_interests WHERE user_id = ?')
    .all(auth.payload.sub) as { category_id: string }[]

  const selectedIds = new Set(userInterests.map((r) => r.category_id))

  return NextResponse.json({
    categories,
    selectedIds: Array.from(selectedIds),
  })
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = InterestsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed.', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { categoryIds } = parsed.data
  const db = getDb()
  const userId = auth.payload.sub

  // Verify all provided category IDs exist
  const placeholders = categoryIds.map(() => '?').join(',')
  const existingCategories = db
    .prepare(`SELECT id FROM categories WHERE id IN (${placeholders})`)
    .all(...categoryIds) as { id: string }[]

  if (existingCategories.length !== categoryIds.length) {
    return NextResponse.json({ error: 'One or more invalid category IDs.' }, { status: 400 })
  }

  // Replace interests and mark first login done in a transaction
  const replaceInterests = db.transaction(() => {
    db.prepare('DELETE FROM user_interests WHERE user_id = ?').run(userId)

    const insertInterest = db.prepare(
      'INSERT INTO user_interests (user_id, category_id) VALUES (?, ?)'
    )
    for (const catId of categoryIds) {
      insertInterest.run(userId, catId)
    }

    db.prepare(
      "UPDATE users SET first_login_done = 1, updated_at = datetime('now') WHERE id = ?"
    ).run(userId)
  })

  replaceInterests()

  return NextResponse.json({ message: 'Interests saved.' })
}

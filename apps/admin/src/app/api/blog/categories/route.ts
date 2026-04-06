export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const categories = db
    .prepare(`
      SELECT c.id, c.name, c.slug, COUNT(p.id) AS post_count
      FROM categories c
      LEFT JOIN posts p ON p.category_id = c.id
        AND p.status = 'published'
        AND p.visibility != 'iPrivate'
      GROUP BY c.id
      HAVING post_count > 0
      ORDER BY post_count DESC, c.name ASC
    `)
    .all() as Array<{ id: string; name: string; slug: string; post_count: number }>

  return NextResponse.json(
    { categories },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

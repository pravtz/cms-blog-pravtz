export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const tags = db
    .prepare(`
      SELECT t.id, t.name, t.slug, COUNT(DISTINCT pt.post_id) AS post_count
      FROM tags t
      JOIN post_tags pt ON pt.tag_id = t.id
      JOIN posts p ON p.id = pt.post_id
        AND p.status = 'published'
        AND p.visibility != 'iPrivate'
      GROUP BY t.id
      ORDER BY post_count DESC, t.name ASC
    `)
    .all() as Array<{ id: string; name: string; slug: string; post_count: number }>

  return NextResponse.json(
    { tags },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

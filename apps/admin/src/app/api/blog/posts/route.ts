export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '12', 10)))
  const offset = (page - 1) * limit

  const db = getDb()

  const posts = db
    .prepare(`
      SELECT
        p.id, p.title, p.subtitle, p.slug, p.excerpt, p.status,
        p.visibility, p.language, p.cover_image, p.reading_time,
        p.seo_title, p.seo_description, p.publish_date,
        p.views, p.created_at, p.updated_at,
        u.name AS author_name,
        c.name AS category_name, c.slug AS category_slug
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'published'
        AND p.visibility != 'iPrivate'
      ORDER BY p.views DESC, p.publish_date DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(limit, offset)

  const { total } = db
    .prepare(`
      SELECT COUNT(*) AS total FROM posts
      WHERE status = 'published' AND visibility != 'iPrivate'
    `)
    .get() as { total: number }

  // Attach tags to each post
  const postIds = (posts as Array<{ id: string }>).map((p) => p.id)
  const tagsMap: Record<string, Array<{ name: string; slug: string }>> = {}
  if (postIds.length > 0) {
    const placeholders = postIds.map(() => '?').join(',')
    const rows = db
      .prepare(`
        SELECT pt.post_id, t.name, t.slug
        FROM post_tags pt
        JOIN tags t ON t.id = pt.tag_id
        WHERE pt.post_id IN (${placeholders})
      `)
      .all(...postIds) as Array<{ post_id: string; name: string; slug: string }>
    for (const row of rows) {
      if (!tagsMap[row.post_id]) tagsMap[row.post_id] = []
      tagsMap[row.post_id].push({ name: row.name, slug: row.slug })
    }
  }

  const enriched = (posts as Array<{ id: string } & Record<string, unknown>>).map((p) => ({
    ...p,
    tags: tagsMap[p.id] ?? [],
  }))

  return NextResponse.json(
    { posts: enriched, total, page, limit },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

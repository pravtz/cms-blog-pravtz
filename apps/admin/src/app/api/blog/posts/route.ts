export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '12', 10)))
  const offset = (page - 1) * limit

  const q = searchParams.get('q')?.trim() || null
  const categorySlug = searchParams.get('category')?.trim() || null
  const tagSlug = searchParams.get('tag')?.trim() || null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : null
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : null

  const db = getDb()

  const conditions: string[] = [
    "p.status = 'published'",
    "p.visibility != 'iPrivate'",
  ]
  const params: (string | number)[] = []

  if (q) {
    conditions.push("(p.title LIKE ? OR p.excerpt LIKE ? OR p.seo_description LIKE ?)")
    const pattern = `%${q}%`
    params.push(pattern, pattern, pattern)
  }

  if (categorySlug) {
    conditions.push("c.slug = ?")
    params.push(categorySlug)
  }

  if (tagSlug) {
    conditions.push("EXISTS (SELECT 1 FROM post_tags pt2 JOIN tags t2 ON t2.id = pt2.tag_id WHERE pt2.post_id = p.id AND t2.slug = ?)")
    params.push(tagSlug)
  }

  if (year) {
    conditions.push("strftime('%Y', COALESCE(p.publish_date, p.created_at)) = ?")
    params.push(String(year))
  }

  if (month && year) {
    conditions.push("strftime('%m', COALESCE(p.publish_date, p.created_at)) = ?")
    params.push(String(month).padStart(2, '0'))
  }

  const where = conditions.join(' AND ')

  const posts = db
    .prepare(`
      SELECT
        p.id, p.title, p.subtitle, p.slug, p.excerpt, p.status,
        p.visibility, p.language, p.cover_image, p.reading_time,
        p.seo_title, p.seo_description, p.publish_date,
        p.views, p.created_at, p.updated_at,
        u.name AS author_name,
        c.name AS category_name, c.slug AS category_slug,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id) AS share_count
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where}
      ORDER BY p.views DESC, p.publish_date DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset)

  const { total } = db
    .prepare(`
      SELECT COUNT(*) AS total FROM posts p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where}
    `)
    .get(...params) as { total: number }

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

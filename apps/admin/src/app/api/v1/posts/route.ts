export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { applyRateLimit, handleOptions } from '@/lib/v1-helpers'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(request: NextRequest) {
  const { headers, error } = await applyRateLimit(request)
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit

  const category = searchParams.get('category')?.trim() || null
  const tag = searchParams.get('tag')?.trim() || null
  const lang = searchParams.get('lang')?.trim() || null
  const sort = searchParams.get('sort')?.trim() || 'date' // date | views | title

  const db = getDb()

  const conditions: string[] = [
    "p.status = 'published'",
    "p.visibility = 'public'",
  ]
  const params: (string | number)[] = []

  if (category) {
    conditions.push('c.slug = ?')
    params.push(category)
  }

  if (tag) {
    conditions.push(
      'EXISTS (SELECT 1 FROM post_tags pt2 JOIN tags t2 ON t2.id = pt2.tag_id WHERE pt2.post_id = p.id AND t2.slug = ?)'
    )
    params.push(tag)
  }

  if (lang) {
    conditions.push('p.language = ?')
    params.push(lang)
  }

  const where = conditions.join(' AND ')

  const orderBy =
    sort === 'views'
      ? 'p.views DESC'
      : sort === 'title'
      ? 'p.title ASC'
      : 'COALESCE(p.publish_date, p.created_at) DESC'

  const posts = db
    .prepare(
      `SELECT
        p.id, p.title, p.subtitle, p.slug, p.excerpt,
        p.language, p.cover_image, p.reading_time,
        p.seo_title, p.seo_description,
        p.publish_date, p.views,
        p.created_at, p.updated_at,
        u.name AS author_name,
        c.name AS category_name, c.slug AS category_slug
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset)

  const { total } = db
    .prepare(
      `SELECT COUNT(*) AS total FROM posts p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE ${where}`
    )
    .get(...params) as { total: number }

  // Attach tags
  const postIds = (posts as Array<{ id: string }>).map((p) => p.id)
  const tagsMap: Record<string, Array<{ name: string; slug: string }>> = {}
  if (postIds.length > 0) {
    const placeholders = postIds.map(() => '?').join(',')
    const tagRows = db
      .prepare(
        `SELECT pt.post_id, t.name, t.slug
         FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
         WHERE pt.post_id IN (${placeholders})`
      )
      .all(...postIds) as Array<{ post_id: string; name: string; slug: string }>
    for (const row of tagRows) {
      if (!tagsMap[row.post_id]) tagsMap[row.post_id] = []
      tagsMap[row.post_id].push({ name: row.name, slug: row.slug })
    }
  }

  const enriched = (posts as Array<{ id: string } & Record<string, unknown>>).map((p) => ({
    ...p,
    tags: tagsMap[p.id] ?? [],
  }))

  const totalPages = Math.ceil(total / limit)

  return NextResponse.json(
    {
      data: enriched,
      meta: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
    },
    { headers }
  )
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { renderMDX } from '@/lib/mdx'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params
  const db = getDb()

  const post = db
    .prepare(
      `SELECT p.*, u.name AS author_name,
        c.name AS category_name, c.slug AS category_slug,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id) AS share_count
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.slug = ? AND p.status = 'published' AND p.visibility != 'iPrivate'`
    )
    .get(slug) as Record<string, unknown> | undefined

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Increment view count
  db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(post.id as string)

  // Track daily views for metrics dashboard
  try {
    const referer = request.headers.get('referer') ?? ''
    let trafficSource = 'direct'
    if (referer) {
      if (/google\.|bing\.|duckduckgo\.|yahoo\.|baidu\.|yandex\./i.test(referer)) {
        trafficSource = 'organic'
      } else if (/facebook\.|twitter\.|x\.com|instagram\.|linkedin\.|pinterest\.|tiktok\./i.test(referer)) {
        trafficSource = 'social'
      } else {
        trafficSource = 'referral'
      }
    }
    const today = new Date().toISOString().slice(0, 10)
    db.prepare(`
      INSERT INTO page_views_daily (post_id, view_date, views, unique_visitors, traffic_source)
      VALUES (?, ?, 1, 1, ?)
      ON CONFLICT(post_id, view_date, traffic_source)
      DO UPDATE SET views = views + 1, unique_visitors = unique_visitors + 1
    `).run(post.id as string, today, trafficSource)
  } catch {
    // Non-critical — ignore tracking errors
  }

  // Get tags
  const tags = db
    .prepare(
      `SELECT t.name, t.slug
      FROM tags t
      JOIN post_tags pt ON pt.tag_id = t.id
      WHERE pt.post_id = ?`
    )
    .all(post.id as string) as Array<{ name: string; slug: string }>

  // Get linked translation (same translation_group_id, different post)
  let translation: { slug: string; language: string } | null = null
  if (post.translation_group_id) {
    translation = db
      .prepare(
        `SELECT slug, language FROM posts
         WHERE translation_group_id = ? AND id != ?
           AND status = 'published' AND visibility != 'iPrivate'
         LIMIT 1`
      )
      .get(post.translation_group_id as string, post.id as string) as typeof translation
  }

  // Render content to HTML
  const content_html = await renderMDX((post.content as string) || '')

  // Get recommendations: 3 posts from same category, excluding current
  let recommendations: unknown[] = []
  if (post.category_id) {
    const recs = db
      .prepare(
        `SELECT p.id, p.title, p.subtitle, p.slug, p.excerpt, p.cover_image,
          p.reading_time, p.publish_date, p.created_at, p.updated_at, p.views,
          p.seo_title, p.seo_description, p.status, p.visibility, p.language,
          u.name AS author_name,
          c.name AS category_name, c.slug AS category_slug
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.category_id = ? AND p.id != ?
          AND p.status = 'published' AND p.visibility != 'iPrivate'
        ORDER BY p.views DESC, COALESCE(p.publish_date, p.created_at) DESC
        LIMIT 3`
      )
      .all(post.category_id as string, post.id as string) as Array<
        { id: string } & Record<string, unknown>
      >

    // Attach tags to recommendations
    if (recs.length > 0) {
      const recIds = recs.map((r) => r.id)
      const placeholders = recIds.map(() => '?').join(',')
      const recTagRows = db
        .prepare(
          `SELECT pt.post_id, t.name, t.slug
          FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
          WHERE pt.post_id IN (${placeholders})`
        )
        .all(...recIds) as Array<{ post_id: string; name: string; slug: string }>
      const recTagsMap: Record<string, Array<{ name: string; slug: string }>> = {}
      for (const row of recTagRows) {
        if (!recTagsMap[row.post_id]) recTagsMap[row.post_id] = []
        recTagsMap[row.post_id].push({ name: row.name, slug: row.slug })
      }
      recommendations = recs.map((r) => ({ ...r, tags: recTagsMap[r.id] ?? [] }))
    }
  }

  return NextResponse.json(
    { post: { ...post, tags, content_html, translation }, recommendations },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

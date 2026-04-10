export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { renderMDX } from '@/lib/mdx'
import { applyRateLimit, handleOptions } from '@/lib/v1-helpers'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { headers, error } = await applyRateLimit(request)
  if (error) return error

  const { slug } = params
  const db = getDb()

  // Return 404 for any non-public post (not 403)
  const post = db
    .prepare(
      `SELECT p.*, u.name AS author_name,
        c.name AS category_name, c.slug AS category_slug
       FROM posts p
       LEFT JOIN users u ON p.author_id = u.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.slug = ? AND p.status = 'published' AND p.visibility = 'public'`
    )
    .get(slug) as Record<string, unknown> | undefined

  if (!post) {
    return NextResponse.json(
      { error: 'Not Found', message: 'Post not found.' },
      { status: 404, headers }
    )
  }

  // Increment view count
  db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(post.id as string)

  // Get tags
  const tags = db
    .prepare(
      `SELECT t.name, t.slug
       FROM tags t JOIN post_tags pt ON pt.tag_id = t.id
       WHERE pt.post_id = ?`
    )
    .all(post.id as string) as Array<{ name: string; slug: string }>

  // Get translations via translation_group_id
  const translations: Array<{ slug: string; language: string }> = []
  if (post.translation_group_id) {
    const siblings = db
      .prepare(
        `SELECT slug, language FROM posts
         WHERE translation_group_id = ? AND id != ?
           AND status = 'published' AND visibility = 'public'`
      )
      .all(post.translation_group_id as string, post.id as string) as Array<{ slug: string; language: string }>
    translations.push(...siblings)
  }

  // Render MDX to sanitized HTML
  const content_html = await renderMDX((post.content as string) || '')

  // Strip internal fields from output
  const {
    id: _id,
    author_id: _authorId,
    category_id: _categoryId,
    content: _content,
    ...publicPost
  } = post

  return NextResponse.json(
    {
      data: {
        ...publicPost,
        tags,
        content_html,
        translations,
      },
    },
    { headers }
  )
}

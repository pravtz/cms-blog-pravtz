export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { sanitizeMDX } from '@/lib/mdx'
import { slugify, uniqueSlug, calculateReadingTime } from '@/lib/utils'
import { canCreatePost } from '@/lib/rbac'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const PostSchema = z.object({
  title: z.string().max(500).optional().default(''),
  subtitle: z.string().max(500).optional().nullable(),
  excerpt: z.string().max(1000).optional().nullable(),
  content: z.string().optional().default(''),
  status: z.enum(['draft', 'published', 'scheduled']).optional().default('draft'),
  visibility: z.enum(['public', 'allPrivate', 'groupPrivate', 'listPrivate', 'iPrivate']).optional().default('public'),
  language: z.string().optional().default('pt-BR'),
  category_id: z.string().uuid().optional().nullable(),
  tag_ids: z.array(z.string().uuid()).optional().default([]),
  cover_image: z.string().optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  publish_date: z.string().optional().nullable(),
  translation_link: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 20
  const offset = (page - 1) * limit

  const db = getDb()
  let query = `
    SELECT p.*, u.name as author_name, c.name as category_name
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
  `
  const params: (string | number)[] = []

  if (status) {
    query += ' WHERE p.status = ?'
    params.push(status)
  }

  query += ' ORDER BY p.updated_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const posts = db.prepare(query).all(...params)
  const total = (
    db
      .prepare(
        status
          ? 'SELECT COUNT(*) as n FROM posts WHERE status = ?'
          : 'SELECT COUNT(*) as n FROM posts'
      )
      .get(...(status ? [status] : [])) as { n: number }
  ).n

  return NextResponse.json({ posts, total, page, limit })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  if (!canCreatePost(auth.payload.role)) {
    return NextResponse.json({ error: 'Insufficient permissions to create posts.' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const data = parsed.data
  const id = uuidv4()
  const db = getDb()

  const baseSlug = data.title ? slugify(data.title) : ''
  const slug = uniqueSlug(baseSlug)
  // Sanitize content before storing to strip any dangerous HTML/XSS vectors
  const safeContent = sanitizeMDX(data.content)
  const readingTime = calculateReadingTime(safeContent)

  const insertPost = db.prepare(`
    INSERT INTO posts (
      id, title, subtitle, slug, excerpt, content, status, visibility,
      language, author_id, category_id, cover_image, reading_time,
      seo_title, seo_description, publish_date, translation_link
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)

  const insertTag = db.prepare(
    'INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)'
  )

  db.transaction(() => {
    insertPost.run(
      id,
      data.title,
      data.subtitle ?? null,
      slug,
      data.excerpt ?? null,
      safeContent,
      data.status,
      data.visibility,
      data.language,
      auth.payload.sub,
      data.category_id ?? null,
      data.cover_image ?? null,
      readingTime,
      data.seo_title ?? null,
      data.seo_description ?? null,
      data.publish_date ?? null,
      data.translation_link ?? null
    )
    for (const tagId of data.tag_ids) {
      insertTag.run(id, tagId)
    }
  })()

  return NextResponse.json({ post: { id, slug } }, { status: 201 })
}

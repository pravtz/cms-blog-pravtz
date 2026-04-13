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
import { logAudit } from '@/lib/audit'

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
  group_ids: z.array(z.string()).optional().default([]),
  list_ids: z.array(z.string().uuid()).optional().default([]),
  cover_image: z.string().optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  publish_date: z.string().optional().nullable(),
  translation_link: z.string().optional().nullable(),
  linked_post_id: z.string().uuid().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const limit = 20
  const offset = (page - 1) * limit

  const db = getDb()
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (status) {
    conditions.push('p.status = ?')
    params.push(status)
  }
  if (search) {
    conditions.push('(p.title LIKE ? OR p.slug LIKE ?)')
    params.push(`%${search}%`, `%${search}%`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const posts = db.prepare(`
    SELECT p.id, p.title, p.slug, p.status, p.visibility, p.language,
      p.reading_time, p.updated_at, p.publish_date, p.translation_group_id,
      u.name as author_name, c.name as category_name,
      CASE WHEN p.translation_group_id IS NOT NULL THEN 1 ELSE 0 END as has_translation
    FROM posts p
    LEFT JOIN users u ON p.author_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    ${where}
    ORDER BY p.updated_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  const total = (
    db
      .prepare(`SELECT COUNT(*) as n FROM posts p ${where}`)
      .get(...params) as { n: number }
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

  // Resolve translation_group_id for bidirectional linking
  let translationGroupId: string | null = null
  if (data.linked_post_id) {
    const linkedPost = db
      .prepare('SELECT id, translation_group_id FROM posts WHERE id = ?')
      .get(data.linked_post_id) as { id: string; translation_group_id: string | null } | undefined
    if (linkedPost) {
      translationGroupId = linkedPost.translation_group_id ?? uuidv4()
    }
  }

  const insertPost = db.prepare(`
    INSERT INTO posts (
      id, title, subtitle, slug, excerpt, content, status, visibility,
      language, author_id, category_id, cover_image, reading_time,
      seo_title, seo_description, publish_date, translation_link, translation_group_id
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `)

  const insertTag = db.prepare(
    'INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)'
  )
  const insertGroupAccess = db.prepare(
    'INSERT OR IGNORE INTO post_group_access (post_id, group_id) VALUES (?, ?)'
  )
  const insertListAccess = db.prepare(
    'INSERT OR IGNORE INTO post_list_access (post_id, list_id) VALUES (?, ?)'
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
      data.translation_link ?? null,
      translationGroupId
    )
    // Link the other post to the same translation group
    if (translationGroupId && data.linked_post_id) {
      db.prepare('UPDATE posts SET translation_group_id = ? WHERE id = ?').run(translationGroupId, data.linked_post_id)
    }
    for (const tagId of data.tag_ids) {
      insertTag.run(id, tagId)
    }
    for (const groupId of data.group_ids) {
      insertGroupAccess.run(id, groupId)
    }
    for (const listId of data.list_ids) {
      insertListAccess.run(id, listId)
    }
  })()

  logAudit({
    action: data.status === 'published' ? 'post.published' : 'post.created',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetId: id,
    targetType: 'post',
    metadata: { title: data.title, status: data.status, slug },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ post: { id, slug } }, { status: 201 })
}

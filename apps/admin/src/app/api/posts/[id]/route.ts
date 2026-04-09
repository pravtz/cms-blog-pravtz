export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { sanitizeMDX } from '@/lib/mdx'
import { z } from 'zod'
import { logAudit } from '@/lib/audit'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function calcReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const post = db
    .prepare(`
      SELECT p.*, u.name as author_name, c.name as category_name, c.id as category_id
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
    `)
    .get(params.id) as Record<string, unknown> | undefined

  if (!post) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const tags = db
    .prepare(`
      SELECT t.id, t.name, t.slug
      FROM tags t
      JOIN post_tags pt ON pt.tag_id = t.id
      WHERE pt.post_id = ?
    `)
    .all(params.id)

  const group_ids = (
    db
      .prepare('SELECT group_id FROM post_group_access WHERE post_id = ?')
      .all(params.id) as Array<{ group_id: string }>
  ).map((r) => r.group_id)

  const list_ids = (
    db
      .prepare('SELECT list_id FROM post_list_access WHERE post_id = ?')
      .all(params.id) as Array<{ list_id: string }>
  ).map((r) => r.list_id)

  return NextResponse.json({ post: { ...post, tags, group_ids, list_ids } })
}

const UpdatePostSchema = z.object({
  title: z.string().max(500).optional(),
  subtitle: z.string().max(500).optional().nullable(),
  excerpt: z.string().max(1000).optional().nullable(),
  content: z.string().optional(),
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  visibility: z.enum(['public', 'allPrivate', 'groupPrivate', 'listPrivate', 'iPrivate']).optional(),
  language: z.string().optional(),
  category_id: z.string().uuid().optional().nullable(),
  tag_ids: z.array(z.string().uuid()).optional(),
  group_ids: z.array(z.string()).optional(),
  list_ids: z.array(z.string().uuid()).optional(),
  cover_image: z.string().optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  publish_date: z.string().optional().nullable(),
  translation_link: z.string().optional().nullable(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const existing = db
    .prepare('SELECT id, author_id, title, slug FROM posts WHERE id = ?')
    .get(params.id) as { id: string; author_id: string; title: string; slug: string } | undefined

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Authors can only edit their own posts; owners can edit any
  const { payload } = auth
  if (payload.role !== 'owner' && existing.author_id !== payload.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = UpdatePostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const data = parsed.data
  const updates: string[] = ['updated_at = datetime(\'now\')']
  const values: unknown[] = []

  if (data.title !== undefined) {
    updates.push('title = ?')
    values.push(data.title)
    // Regenerate slug only if title changed and slug still matches old title pattern
    const newSlug = data.title
      ? slugify(data.title) + '-' + existing.slug.split('-').pop()
      : existing.slug
    updates.push('slug = ?')
    values.push(newSlug)
  }
  if (data.subtitle !== undefined) { updates.push('subtitle = ?'); values.push(data.subtitle) }
  if (data.excerpt !== undefined) { updates.push('excerpt = ?'); values.push(data.excerpt) }
  if (data.content !== undefined) {
    const safeContent = sanitizeMDX(data.content)
    updates.push('content = ?')
    values.push(safeContent)
    updates.push('reading_time = ?')
    values.push(calcReadingTime(safeContent))
  }
  if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status) }
  if (data.visibility !== undefined) { updates.push('visibility = ?'); values.push(data.visibility) }
  if (data.language !== undefined) { updates.push('language = ?'); values.push(data.language) }
  if (data.category_id !== undefined) { updates.push('category_id = ?'); values.push(data.category_id) }
  if (data.cover_image !== undefined) { updates.push('cover_image = ?'); values.push(data.cover_image) }
  if (data.seo_title !== undefined) { updates.push('seo_title = ?'); values.push(data.seo_title) }
  if (data.seo_description !== undefined) { updates.push('seo_description = ?'); values.push(data.seo_description) }
  if (data.publish_date !== undefined) { updates.push('publish_date = ?'); values.push(data.publish_date) }
  if (data.translation_link !== undefined) { updates.push('translation_link = ?'); values.push(data.translation_link) }

  const deleteTags = db.prepare('DELETE FROM post_tags WHERE post_id = ?')
  const insertTag = db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)')
  const deleteGroupAccess = db.prepare('DELETE FROM post_group_access WHERE post_id = ?')
  const insertGroupAccess = db.prepare('INSERT OR IGNORE INTO post_group_access (post_id, group_id) VALUES (?, ?)')
  const deleteListAccess = db.prepare('DELETE FROM post_list_access WHERE post_id = ?')
  const insertListAccess = db.prepare('INSERT OR IGNORE INTO post_list_access (post_id, list_id) VALUES (?, ?)')

  db.transaction(() => {
    db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...values, params.id)
    if (data.tag_ids !== undefined) {
      deleteTags.run(params.id)
      for (const tagId of data.tag_ids) {
        insertTag.run(params.id, tagId)
      }
    }
    if (data.group_ids !== undefined) {
      deleteGroupAccess.run(params.id)
      for (const groupId of data.group_ids) {
        insertGroupAccess.run(params.id, groupId)
      }
    }
    if (data.list_ids !== undefined) {
      deleteListAccess.run(params.id)
      for (const listId of data.list_ids) {
        insertListAccess.run(params.id, listId)
      }
    }
  })()

  const auditAction = data.status === 'published' ? 'post.published' : 'post.edited'
  logAudit({
    action: auditAction,
    actorId: payload.sub,
    actorEmail: payload.email,
    targetId: params.id,
    targetType: 'post',
    metadata: { title: data.title ?? existing.title, status: data.status },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const existing = db
    .prepare('SELECT id, author_id FROM posts WHERE id = ?')
    .get(params.id) as { id: string; author_id: string } | undefined

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { payload } = auth
  if (payload.role !== 'owner' && existing.author_id !== payload.sub) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  db.prepare('DELETE FROM posts WHERE id = ?').run(params.id)

  logAudit({
    action: 'post.deleted',
    actorId: payload.sub,
    actorEmail: payload.email,
    targetId: params.id,
    targetType: 'post',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ ok: true })
}

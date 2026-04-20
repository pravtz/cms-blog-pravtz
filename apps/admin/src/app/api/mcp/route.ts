export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * MCP (Model Context Protocol) HTTP endpoint for Nexus CMS.
 *
 * Accepts POST requests with a JSON body:
 * { tool: string, params: object }
 *
 * Authentication: Authorization: Bearer mcp_<key>
 *
 * Supported tools:
 *   list_posts      - List published posts with optional filters
 *   get_post        - Get a post by slug (with full content)
 *   create_post     - Create a new draft post
 *   update_post     - Update an existing post
 *   publish_post    - Publish a draft post
 *   list_categories - List all categories
 *   list_tags       - List all tags
 *   search_posts    - Search posts by keyword
 */

import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { slugify } from '@/lib/utils'

// ── Auth helpers ─────────────────────────────────────────────────────────────

function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const raw = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!raw || !raw.startsWith('mcp_')) return false

  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const db = getDb()
  const row = db
    .prepare('SELECT id FROM mcp_api_keys WHERE key_hash = ? AND revoked = 0')
    .get(hash) as { id: string } | undefined

  if (!row) return false

  // Update last_used_at
  db.prepare(`UPDATE mcp_api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(row.id)
  return true
}

// ── Tool handlers ─────────────────────────────────────────────────────────────

type ToolParams = Record<string, unknown>

interface Post {
  id: string
  title: string
  slug: string
  status: string
  visibility: string
  language: string
  category_name: string | null
  reading_time: number | null
  views: number
  created_at: string
  updated_at: string
  publish_date: string | null
  cover_image: string | null
  excerpt: string | null
  content?: string
}

function toolListPosts(params: ToolParams) {
  const db = getDb()
  const page = Math.max(1, Number(params.page ?? 1))
  const limit = Math.min(50, Math.max(1, Number(params.limit ?? 20)))
  const offset = (page - 1) * limit
  const status = (params.status as string) ?? 'published'
  const category = (params.category as string) || null
  const tag = (params.tag as string) || null
  const lang = (params.language as string) || null

  const conditions: string[] = []
  const args: (string | number)[] = []

  if (status === 'all') {
    // no status filter
  } else {
    conditions.push('p.status = ?')
    args.push(status)
  }
  if (category) {
    conditions.push('c.slug = ?')
    args.push(category)
  }
  if (tag) {
    conditions.push(
      'EXISTS (SELECT 1 FROM post_tags pt2 JOIN tags t2 ON t2.id = pt2.tag_id WHERE pt2.post_id = p.id AND t2.slug = ?)'
    )
    args.push(tag)
  }
  if (lang) {
    conditions.push('p.language = ?')
    args.push(lang)
  }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  const posts = db
    .prepare(
      `SELECT p.id, p.title, p.slug, p.status, p.visibility, p.language,
              c.name AS category_name, p.reading_time, p.views,
              p.created_at, p.updated_at, p.publish_date, p.cover_image, p.excerpt
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY COALESCE(p.publish_date, p.created_at) DESC
       LIMIT ? OFFSET ?`
    )
    .all([...args, limit, offset]) as Post[]

  const total = (
    db.prepare(`SELECT COUNT(*) as n FROM posts p LEFT JOIN categories c ON c.id = p.category_id ${where}`).get(args) as { n: number }
  ).n

  return { posts, total, page, limit }
}

function toolGetPost(params: ToolParams) {
  const slug = params.slug as string
  if (!slug) throw new Error('slug is required')

  const db = getDb()
  const post = db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
              u.name AS author_name
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN users u ON u.id = p.author_id
       WHERE p.slug = ?`
    )
    .get(slug) as (Post & { author_name: string; category_slug: string }) | undefined

  if (!post) throw new Error(`Post not found: ${slug}`)

  const tags = db
    .prepare(
      `SELECT t.name, t.slug FROM tags t
       JOIN post_tags pt ON pt.tag_id = t.id
       WHERE pt.post_id = ?`
    )
    .all(post.id) as { name: string; slug: string }[]

  return { ...post, tags }
}

function toolCreatePost(params: ToolParams) {
  const title = (params.title as string)?.trim()
  if (!title) throw new Error('title is required')

  const db = getDb()

  // Resolve author: first owner
  const owner = db
    .prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1")
    .get() as { id: string }
  if (!owner) throw new Error('No owner user found in CMS')

  const id = crypto.randomUUID()
  const slug = slugify(title)

  // Ensure slug uniqueness
  let finalSlug = slug
  const existing = db.prepare('SELECT id FROM posts WHERE slug = ?').get(finalSlug)
  if (existing) finalSlug = `${slug}-${Date.now()}`

  const content = (params.content as string) ?? ''
  const excerpt = (params.excerpt as string) ?? ''
  const language = (params.language as string) ?? 'pt-BR'
  const visibility = (params.visibility as string) ?? 'public'
  const words = content.split(/\s+/).filter(Boolean).length
  const readingTime = Math.max(1, Math.round(words / 200))

  db.prepare(
    `INSERT INTO posts (id, title, slug, content, excerpt, status, visibility, language,
                        reading_time, author_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(id, title, finalSlug, content, excerpt, visibility, language, readingTime, owner.id)

  return { id, slug: finalSlug, status: 'draft', message: 'Post created as draft.' }
}

function toolUpdatePost(params: ToolParams) {
  const slug = (params.slug as string)?.trim()
  if (!slug) throw new Error('slug is required')

  const db = getDb()
  const post = db.prepare('SELECT id FROM posts WHERE slug = ?').get(slug) as
    | { id: string }
    | undefined
  if (!post) throw new Error(`Post not found: ${slug}`)

  const updates: string[] = []
  const args: unknown[] = []

  if (params.title !== undefined) {
    updates.push('title = ?')
    args.push(params.title)
  }
  if (params.content !== undefined) {
    updates.push('content = ?')
    args.push(params.content)
    const words = String(params.content).split(/\s+/).filter(Boolean).length
    updates.push('reading_time = ?')
    args.push(Math.max(1, Math.round(words / 200)))
  }
  if (params.excerpt !== undefined) {
    updates.push('excerpt = ?')
    args.push(params.excerpt)
  }
  if (params.visibility !== undefined) {
    updates.push('visibility = ?')
    args.push(params.visibility)
  }
  if (params.language !== undefined) {
    updates.push('language = ?')
    args.push(params.language)
  }

  if (updates.length === 0) throw new Error('No fields to update provided')

  updates.push("updated_at = datetime('now')")
  args.push(post.id)

  db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).run(...args)

  return { id: post.id, slug, message: 'Post updated successfully.' }
}

function toolPublishPost(params: ToolParams) {
  const slug = (params.slug as string)?.trim()
  if (!slug) throw new Error('slug is required')

  const db = getDb()
  const post = db.prepare('SELECT id, status FROM posts WHERE slug = ?').get(slug) as
    | { id: string; status: string }
    | undefined
  if (!post) throw new Error(`Post not found: ${slug}`)

  db.prepare(
    `UPDATE posts SET status = 'published', visibility = COALESCE(visibility, 'public'),
     publish_date = COALESCE(publish_date, datetime('now')),
     updated_at = datetime('now')
     WHERE id = ?`
  ).run(post.id)

  return { id: post.id, slug, status: 'published', message: 'Post published successfully.' }
}

function toolListCategories() {
  const db = getDb()
  const categories = db
    .prepare(
      `SELECT c.id, c.name, c.slug,
              COUNT(p.id) AS post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id AND p.status = 'published'
       GROUP BY c.id
       ORDER BY c.name ASC`
    )
    .all() as { id: string; name: string; slug: string; post_count: number }[]

  return { categories }
}

function toolListTags() {
  const db = getDb()
  const tags = db
    .prepare(
      `SELECT t.id, t.name, t.slug,
              COUNT(pt.post_id) AS post_count
       FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id = t.id
       GROUP BY t.id
       ORDER BY post_count DESC, t.name ASC`
    )
    .all() as { id: string; name: string; slug: string; post_count: number }[]

  return { tags }
}

function toolSearchPosts(params: ToolParams) {
  const query = (params.query as string)?.trim()
  if (!query) throw new Error('query is required')

  const db = getDb()
  const like = `%${query}%`
  const posts = db
    .prepare(
      `SELECT p.id, p.title, p.slug, p.status, p.visibility, p.excerpt,
              p.created_at, p.updated_at
       FROM posts p
       WHERE (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)
       ORDER BY COALESCE(p.publish_date, p.created_at) DESC
       LIMIT 20`
    )
    .all(like, like, like) as Post[]

  return { posts, query }
}

// ── Tool registry ─────────────────────────────────────────────────────────────

const TOOLS: Record<string, (params: ToolParams) => unknown> = {
  list_posts: toolListPosts,
  get_post: toolGetPost,
  create_post: toolCreatePost,
  update_post: toolUpdatePost,
  publish_post: toolPublishPost,
  list_categories: toolListCategories,
  list_tags: toolListTags,
  search_posts: toolSearchPosts,
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    name: 'nexus-cms-mcp',
    version: '1.0.0',
    description: 'MCP interface for Nexus CMS',
    tools: Object.keys(TOOLS).map((name) => ({ name })),
  })
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json(
      { error: 'Invalid or missing MCP API key.' },
      { status: 401 }
    )
  }

  let body: { tool?: string; params?: ToolParams }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { tool, params = {} } = body
  if (!tool) {
    return NextResponse.json({ error: 'tool field is required.' }, { status: 400 })
  }

  const handler = TOOLS[tool]
  if (!handler) {
    return NextResponse.json(
      { error: `Unknown tool: ${tool}`, available_tools: Object.keys(TOOLS) },
      { status: 404 }
    )
  }

  try {
    const result = handler(params)
    return NextResponse.json({ tool, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

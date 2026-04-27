import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getDb, ownerExists } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SetupSchema = z.object({
  // Step 1: Owner
  ownerName: z.string().min(2).max(100),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(128),
  // Step 2: DB (SQLite only for v0.1)
  dbType: z.enum(['sqlite']).default('sqlite'),
  // Step 3: SMTP
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().email().optional(),
  // Step 4: Blog identity
  blogName: z.string().min(1).max(200),
  blogDescription: z.string().max(500).optional(),
  blogUrl: z.string().url(),
})

const LOCAL_SEED_POSTS = Array.from({ length: 10 }, (_, index) => {
  const postNumber = String(index + 1).padStart(2, '0')

  return {
    title: `Post de exemplo ${postNumber}`,
    slug: `post-de-exemplo-${postNumber}`,
    excerpt: `Resumo do post de exemplo ${postNumber} para o ambiente local.`,
    content: `# Post de exemplo ${postNumber}

Este artigo foi criado automaticamente durante o setup local para facilitar testes manuais e smoke checks.

- Ambiente: local
- Ordem: ${postNumber}
- Objetivo: validar feed, detalhe e APIs públicas
`,
  }
})

function shouldSeedLocalPosts(): boolean {
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
}

function seedLocalPosts(db: ReturnType<typeof getDb>, ownerId: string): void {
  if (!shouldSeedLocalPosts()) {
    return
  }

  const existingPosts = db
    .prepare('SELECT COUNT(*) AS total FROM posts')
    .get() as { total: number }

  if (existingPosts.total > 0) {
    return
  }

  const insertPost = db.prepare(`
    INSERT INTO posts (
      id, title, slug, excerpt, content, status, visibility,
      language, author_id, reading_time, publish_date, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, 'published', 'public', 'pt-BR', ?, ?, ?, ?, ?
    )
  `)

  const baseTimestamp = Date.now()

  for (let index = 0; index < LOCAL_SEED_POSTS.length; index += 1) {
    const post = LOCAL_SEED_POSTS[index]
    const publishDate = new Date(baseTimestamp - index * 24 * 60 * 60 * 1000).toISOString()

    insertPost.run(
      randomUUID(),
      post.title,
      post.slug,
      post.excerpt,
      post.content,
      ownerId,
      3,
      publishDate,
      publishDate,
      publishDate
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    if (ownerExists()) {
      return NextResponse.json(
        { error: 'Setup has already been completed.' },
        { status: 409 }
      )
    }

    const body = await request.json()
    const parsed = SetupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    const db = getDb()

    // Hash password outside transaction (async — bcrypt is always async)
    const passwordHash = await hashPassword(data.ownerPassword)

    db.transaction(() => {
      const userId = randomUUID()
      db.prepare(
        `INSERT INTO users (id, name, email, password_hash, role, status)
         VALUES (?, ?, ?, ?, 'owner', 'active')`
      ).run(userId, data.ownerName, data.ownerEmail, passwordHash)

      // Add owner to system groups so RBAC checks that delegate to group membership succeed.
      db.prepare(
        `INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, 'group-owner')`
      ).run(userId)
      db.prepare(
        `INSERT OR IGNORE INTO group_members (user_id, group_id) VALUES (?, 'group-default')`
      ).run(userId)

      // Save settings
      const settings: Record<string, string> = {
        blog_name: data.blogName,
        blog_description: data.blogDescription ?? '',
        blog_url: data.blogUrl,
        db_type: data.dbType,
        setup_complete: 'true',
      }

      if (data.smtpHost) settings['smtp_host'] = data.smtpHost
      if (data.smtpPort) settings['smtp_port'] = String(data.smtpPort)
      if (data.smtpUser) settings['smtp_user'] = data.smtpUser
      if (data.smtpPass) settings['smtp_pass'] = data.smtpPass
      if (data.smtpFrom) settings['smtp_from'] = data.smtpFrom

      for (const [key, value] of Object.entries(settings)) {
        db.prepare(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
        ).run(key, value)
      }

      seedLocalPosts(db, userId)
    })()

    logAudit({
      action: 'setup.completed',
      metadata: { blogName: data.blogName, blogUrl: data.blogUrl },
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Setup error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred during setup.' },
      { status: 500 }
    )
  }
}

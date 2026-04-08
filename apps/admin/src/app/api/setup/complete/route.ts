import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { getDb, ownerExists, setSetting } from '@/lib/db'
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

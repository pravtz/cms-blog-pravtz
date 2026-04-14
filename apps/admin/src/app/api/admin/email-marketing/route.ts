export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import nodemailer from 'nodemailer'
import { getDb, getSetting } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

interface Campaign {
  id: string
  name: string
  subject: string
  body: string
  status: string
  scheduled_at: string | null
  sent_at: string | null
  recipient_count: number
  sent_count: number
  created_by: string
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit

  const db = getDb()

  // Process any due scheduled campaigns
  processDueScheduled(db)

  let where = ''
  const params: unknown[] = []
  if (status !== 'all') {
    where = 'WHERE status = ?'
    params.push(status)
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM email_campaigns ${where}`)
    .get(...params) as { total: number }

  const campaigns = db
    .prepare(
      `SELECT * FROM email_campaigns ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Campaign[]

  const smtpConfigured = !!(getSetting('smtp_host') && getSetting('smtp_port'))

  return NextResponse.json({
    data: campaigns,
    meta: {
      total: countRow.total,
      page,
      limit,
      totalPages: Math.ceil(countRow.total / limit),
      smtpConfigured,
    },
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const { name, subject, body: campaignBody } = body
  if (!name || typeof name !== 'string' || !name.trim())
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  if (!subject || typeof subject !== 'string' || !subject.trim())
    return NextResponse.json({ error: 'Assunto obrigatório' }, { status: 400 })
  if (!campaignBody || typeof campaignBody !== 'string' || !campaignBody.trim())
    return NextResponse.json({ error: 'Corpo obrigatório' }, { status: 400 })

  const db = getDb()
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(
    `INSERT INTO email_campaigns (id, name, subject, body, status, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`
  ).run(id, name.trim(), subject.trim(), campaignBody.trim(), auth.payload.sub, now, now)

  const campaign = db
    .prepare('SELECT * FROM email_campaigns WHERE id = ?')
    .get(id) as Campaign

  return NextResponse.json({ data: campaign }, { status: 201 })
}

function processDueScheduled(db: ReturnType<typeof getDb>) {
  const now = new Date().toISOString()
  const due = db
    .prepare(
      `SELECT id FROM email_campaigns WHERE status = 'scheduled' AND scheduled_at <= ?`
    )
    .all(now) as { id: string }[]

  for (const { id } of due) {
    // Fire-and-forget; actual sending happens asynchronously via the send route
    // Here we just mark them back to "sending" so the send endpoint is needed.
    // For simplicity, process them inline (synchronous SQLite is fine for small lists)
    try {
      sendCampaignById(db, id)
    } catch {
      // Non-fatal — leave as scheduled so it retries
    }
  }
}

export function sendCampaignById(db: ReturnType<typeof getDb>, campaignId: string): void {
  const host = getSetting('smtp_host')
  const portStr = getSetting('smtp_port')
  const user = getSetting('smtp_user')
  const pass = getSetting('smtp_pass')
  const from = getSetting('smtp_from') ?? 'noreply@nexuscms.local'

  if (!host || !portStr) return

  const transporter = nodemailer.createTransport({
    host,
    port: Number(portStr),
    secure: Number(portStr) === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  const campaign = db
    .prepare('SELECT * FROM email_campaigns WHERE id = ?')
    .get(campaignId) as {
    id: string
    subject: string
    body: string
    status: string
  } | undefined

  if (!campaign || campaign.status === 'sent') return

  const subscribers = db
    .prepare(`SELECT email FROM newsletter_subscribers WHERE status = 'active'`)
    .all() as { email: string }[]

  const recipientCount = subscribers.length
  let sentCount = 0

  for (const sub of subscribers) {
    const name = sub.email.split('@')[0]
    const personalizedBody = campaign.body
      .replace(/\{\{nome\}\}/gi, name)
      .replace(/\{\{email\}\}/gi, sub.email)
    const personalizedSubject = campaign.subject
      .replace(/\{\{nome\}\}/gi, name)
      .replace(/\{\{email\}\}/gi, sub.email)

    try {
      transporter.sendMail({
        from,
        to: sub.email,
        subject: personalizedSubject,
        html: personalizedBody,
        text: personalizedBody.replace(/<[^>]+>/g, ''),
      })
      sentCount++
    } catch {
      // Continue sending to remaining subscribers
    }
  }

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE email_campaigns
     SET status = 'sent', sent_at = ?, recipient_count = ?, sent_count = ?, updated_at = ?
     WHERE id = ?`
  ).run(now, recipientCount, sentCount, now, campaignId)
}

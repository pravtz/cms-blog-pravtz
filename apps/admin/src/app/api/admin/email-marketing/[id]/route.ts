export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

interface RouteContext {
  params: { id: string }
}

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

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const campaign = db
    .prepare('SELECT * FROM email_campaigns WHERE id = ?')
    .get(params.id) as Campaign | undefined

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  return NextResponse.json({ data: campaign })
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const existing = db
    .prepare('SELECT * FROM email_campaigns WHERE id = ?')
    .get(params.id) as Campaign | undefined

  if (!existing) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  if (existing.status === 'sent') {
    return NextResponse.json({ error: 'Campanhas enviadas não podem ser editadas' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 })

  const name = typeof body.name === 'string' ? body.name.trim() : existing.name
  const subject = typeof body.subject === 'string' ? body.subject.trim() : existing.subject
  const campaignBody = typeof body.body === 'string' ? body.body.trim() : existing.body

  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  if (!subject) return NextResponse.json({ error: 'Assunto obrigatório' }, { status: 400 })
  if (!campaignBody) return NextResponse.json({ error: 'Corpo obrigatório' }, { status: 400 })

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE email_campaigns SET name = ?, subject = ?, body = ?, updated_at = ? WHERE id = ?`
  ).run(name, subject, campaignBody, now, params.id)

  const updated = db
    .prepare('SELECT * FROM email_campaigns WHERE id = ?')
    .get(params.id) as Campaign

  return NextResponse.json({ data: updated })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const existing = db
    .prepare('SELECT id FROM email_campaigns WHERE id = ?')
    .get(params.id) as { id: string } | undefined

  if (!existing) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  db.prepare('DELETE FROM email_campaigns WHERE id = ?').run(params.id)

  return NextResponse.json({ ok: true })
}

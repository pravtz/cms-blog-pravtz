export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb, getSetting } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import { sendCampaignById } from '../../route'

interface RouteContext {
  params: { id: string }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const campaign = db
    .prepare('SELECT * FROM email_campaigns WHERE id = ?')
    .get(params.id) as { id: string; status: string } | undefined

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  if (campaign.status === 'sent') {
    return NextResponse.json({ error: 'Campanha já enviada' }, { status: 400 })
  }

  const smtpConfigured = !!(getSetting('smtp_host') && getSetting('smtp_port'))
  if (!smtpConfigured) {
    return NextResponse.json({ error: 'SMTP não configurado' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const scheduledAt = typeof body?.scheduled_at === 'string' ? body.scheduled_at : null

  if (scheduledAt) {
    // Schedule for later
    const scheduledDate = new Date(scheduledAt)
    if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
      return NextResponse.json(
        { error: 'Data de agendamento inválida ou no passado' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    db.prepare(
      `UPDATE email_campaigns SET status = 'scheduled', scheduled_at = ?, updated_at = ? WHERE id = ?`
    ).run(scheduledDate.toISOString(), now, params.id)

    const updated = db
      .prepare('SELECT * FROM email_campaigns WHERE id = ?')
      .get(params.id)

    return NextResponse.json({ data: updated })
  }

  // Send immediately
  sendCampaignById(db, params.id)

  const updated = db
    .prepare('SELECT * FROM email_campaigns WHERE id = ?')
    .get(params.id)

  return NextResponse.json({ data: updated })
}

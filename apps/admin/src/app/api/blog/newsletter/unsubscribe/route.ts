export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
  }

  const db = getDb()
  const subscriber = db
    .prepare(
      `SELECT id, status FROM newsletter_subscribers WHERE unsubscribe_token = ?`
    )
    .get(token) as { id: string; status: string } | undefined

  if (!subscriber) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 400 })
  }

  if (subscriber.status === 'unsubscribed') {
    return NextResponse.json({ ok: true, message: 'Você já foi desinscrito.' })
  }

  db.prepare(
    `UPDATE newsletter_subscribers
     SET status = 'unsubscribed', updated_at = datetime('now')
     WHERE id = ?`
  ).run(subscriber.id)

  return NextResponse.json({ ok: true, message: 'Desinscrito com sucesso.' })
}

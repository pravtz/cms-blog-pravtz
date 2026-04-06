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
      `SELECT id, status, token_expires
       FROM newsletter_subscribers
       WHERE token = ?`
    )
    .get(token) as { id: string; status: string; token_expires: string } | undefined

  if (!subscriber) {
    return NextResponse.json({ error: 'Token inválido ou já utilizado' }, { status: 400 })
  }

  if (subscriber.status === 'active') {
    return NextResponse.json({ ok: true, message: 'Inscrição já confirmada' })
  }

  // Check expiry
  if (subscriber.token_expires && new Date(subscriber.token_expires) < new Date()) {
    return NextResponse.json({ error: 'Token expirado' }, { status: 400 })
  }

  // Activate subscriber
  db.prepare(
    `UPDATE newsletter_subscribers
     SET status = 'active', token = NULL, token_expires = NULL,
         confirmed_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`
  ).run(subscriber.id)

  return NextResponse.json({ ok: true, message: 'Inscrição confirmada com sucesso!' })
}

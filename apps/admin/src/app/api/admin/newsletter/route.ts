export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

interface Subscriber {
  id: string
  email: string
  status: string
  confirmed_at: string | null
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'all'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const exportCsv = searchParams.get('export') === 'csv'
  const offset = (page - 1) * limit

  const db = getDb()

  let where = ''
  const params: string[] = []
  if (status !== 'all') {
    where = 'WHERE status = ?'
    params.push(status)
  }

  if (exportCsv) {
    const rows = db
      .prepare(`SELECT email, status, confirmed_at, created_at FROM newsletter_subscribers ${where} ORDER BY created_at DESC`)
      .all(...params) as { email: string; status: string; confirmed_at: string | null; created_at: string }[]

    const lines = ['email,status,confirmed_at,subscribed_at']
    for (const row of rows) {
      const confirmedAt = row.confirmed_at ?? ''
      lines.push(`${row.email},${row.status},${confirmedAt},${row.created_at}`)
    }
    const csv = lines.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="newsletter-subscribers.csv"',
      },
    })
  }

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM newsletter_subscribers ${where}`)
    .get(...params) as { total: number }

  const subscribers = db
    .prepare(
      `SELECT id, email, status, confirmed_at, created_at, updated_at
       FROM newsletter_subscribers
       ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset) as Subscriber[]

  return NextResponse.json({
    data: subscribers,
    meta: {
      total: countRow.total,
      page,
      limit,
      totalPages: Math.ceil(countRow.total / limit),
    },
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null

  if (!id) {
    return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })
  }

  const db = getDb()
  const subscriber = db
    .prepare('SELECT id FROM newsletter_subscribers WHERE id = ?')
    .get(id) as { id: string } | undefined

  if (!subscriber) {
    return NextResponse.json({ error: 'Inscrito não encontrado' }, { status: 404 })
  }

  db.prepare('DELETE FROM newsletter_subscribers WHERE id = ?').run(id)

  return NextResponse.json({ ok: true })
}

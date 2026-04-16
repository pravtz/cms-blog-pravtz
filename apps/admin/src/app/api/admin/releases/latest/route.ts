import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const db = getDb()

  const current = db
    .prepare('SELECT version, release_date, type FROM releases WHERE is_current = 1 LIMIT 1')
    .get() as { version: string; release_date: string; type: string } | undefined

  const latest = db
    .prepare('SELECT version, release_date, type FROM releases ORDER BY release_date DESC, created_at DESC LIMIT 1')
    .get() as { version: string; release_date: string; type: string } | undefined

  return NextResponse.json({ current: current ?? null, latest: latest ?? null })
}

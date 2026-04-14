export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'

interface Params {
  params: { userId: string }
}

// PUT /api/admin/ai/users/[userId]/quota — update user quota and AI enable/disable
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const { userId } = params
  const db = getDb()

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const body = await request.json() as {
    aiEnabled?: boolean
    monthlyTokens?: number
    resetMonthly?: boolean
    accumulating?: boolean
  }

  db.prepare(`
    INSERT INTO ai_user_quotas (user_id, ai_enabled, monthly_tokens, reset_monthly, accumulating)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      ai_enabled = excluded.ai_enabled,
      monthly_tokens = excluded.monthly_tokens,
      reset_monthly = excluded.reset_monthly,
      accumulating = excluded.accumulating
  `).run(
    userId,
    body.aiEnabled ? 1 : 0,
    body.monthlyTokens ?? 50000,
    body.resetMonthly !== false ? 1 : 0,
    body.accumulating ? 1 : 0
  )

  return NextResponse.json({ success: true })
}

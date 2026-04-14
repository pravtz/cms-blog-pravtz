export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/admin/ai/me — current user's AI status and quota usage
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const userId = auth.payload.sub
  const db = getDb()
  const month = currentMonth()

  // Check provider is enabled
  const provider = db.prepare(
    'SELECT enabled FROM ai_providers WHERE enabled = 1 ORDER BY created_at DESC LIMIT 1'
  ).get() as { enabled: number } | undefined

  const providerActive = Boolean(provider?.enabled)

  const row = db.prepare(`
    SELECT q.ai_enabled, q.monthly_tokens,
           COALESCE(u.tokens_used, 0) as tokens_used
    FROM ai_user_quotas q
    LEFT JOIN (
      SELECT user_id, tokens_used FROM ai_usage WHERE user_id = ? AND month = ?
    ) u ON u.user_id = q.user_id
    WHERE q.user_id = ?
  `).get(userId, month, userId) as {
    ai_enabled: number
    monthly_tokens: number
    tokens_used: number
  } | undefined

  if (!row) {
    return NextResponse.json({
      aiEnabled: false,
      providerActive,
      monthlyTokens: 0,
      tokensUsed: 0,
    })
  }

  return NextResponse.json({
    aiEnabled: Boolean(row.ai_enabled),
    providerActive,
    monthlyTokens: row.monthly_tokens,
    tokensUsed: row.tokens_used,
  })
}

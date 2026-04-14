export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { encrypt, maskApiKey } from '@/lib/encryption'
import crypto from 'crypto'

interface AiProvider {
  id: string
  name: string
  api_key_encrypted: string
  model: string
  base_url: string | null
  enabled: number
  created_at: string
  updated_at: string
}

interface AiUsageRow {
  user_id: string
  user_name: string
  user_email: string
  tokens_used: number
}

interface AiUserQuota {
  user_id: string
  ai_enabled: number
  monthly_tokens: number
  reset_monthly: number
  accumulating: number
  user_name: string
  user_email: string
  tokens_used: number
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// GET /api/admin/ai — provider config, usage overview, quota table
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const month = currentMonth()

  const provider = db.prepare('SELECT * FROM ai_providers ORDER BY created_at DESC LIMIT 1').get() as AiProvider | undefined

  // Usage overview for current month
  const usageRows = db.prepare(`
    SELECT u.id as user_id, u.name as user_name, u.email as user_email,
           COALESCE(au.tokens_used, 0) as tokens_used
    FROM users u
    LEFT JOIN ai_usage au ON au.user_id = u.id AND au.month = ?
    WHERE u.status = 'active'
    ORDER BY tokens_used DESC
  `).all(month) as AiUsageRow[]

  const totalTokens = usageRows.reduce((sum, r) => sum + r.tokens_used, 0)
  // Rough cost estimate (GPT-4o at $5/1M input tokens)
  const estimatedUsd = (totalTokens / 1_000_000) * 5

  // User quota table
  const quotaRows = db.prepare(`
    SELECT u.id as user_id, u.name as user_name, u.email as user_email,
           COALESCE(q.ai_enabled, 0) as ai_enabled,
           COALESCE(q.monthly_tokens, 50000) as monthly_tokens,
           COALESCE(q.reset_monthly, 1) as reset_monthly,
           COALESCE(q.accumulating, 0) as accumulating,
           COALESCE(au.tokens_used, 0) as tokens_used
    FROM users u
    LEFT JOIN ai_user_quotas q ON q.user_id = u.id
    LEFT JOIN ai_usage au ON au.user_id = u.id AND au.month = ?
    WHERE u.status = 'active'
    ORDER BY u.name
  `).all(month) as AiUserQuota[]

  return NextResponse.json({
    provider: provider
      ? {
          id: provider.id,
          name: provider.name,
          apiKeyMasked: maskApiKey(provider.api_key_encrypted),
          model: provider.model,
          baseUrl: provider.base_url,
          enabled: Boolean(provider.enabled),
          updatedAt: provider.updated_at,
        }
      : null,
    usage: {
      month,
      totalTokens,
      estimatedUsd: Number(estimatedUsd.toFixed(4)),
      byUser: usageRows.map((r) => ({
        userId: r.user_id,
        userName: r.user_name,
        userEmail: r.user_email,
        tokensUsed: r.tokens_used,
      })),
    },
    quotas: quotaRows.map((r) => ({
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      aiEnabled: Boolean(r.ai_enabled),
      monthlyTokens: r.monthly_tokens,
      resetMonthly: Boolean(r.reset_monthly),
      accumulating: Boolean(r.accumulating),
      tokensUsed: r.tokens_used,
      pct: r.monthly_tokens > 0 ? Math.round((r.tokens_used / r.monthly_tokens) * 100) : 0,
    })),
  })
}

// POST /api/admin/ai — create or update provider config
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const body = await request.json() as {
    name?: string
    apiKey?: string
    model?: string
    baseUrl?: string
    enabled?: boolean
  }

  if (!body.name || !body.model) {
    return NextResponse.json({ error: 'name and model are required' }, { status: 400 })
  }

  const db = getDb()
  const existing = db.prepare('SELECT * FROM ai_providers ORDER BY created_at DESC LIMIT 1').get() as AiProvider | undefined

  if (existing) {
    // Update existing provider
    const encryptedKey = body.apiKey
      ? encrypt(body.apiKey)
      : existing.api_key_encrypted

    db.prepare(`
      UPDATE ai_providers
      SET name = ?, api_key_encrypted = ?, model = ?, base_url = ?, enabled = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(body.name, encryptedKey, body.model, body.baseUrl ?? null, body.enabled ? 1 : 0, existing.id)

    return NextResponse.json({ success: true })
  } else {
    // Create new provider — apiKey is required
    if (!body.apiKey) {
      return NextResponse.json({ error: 'apiKey is required for new provider' }, { status: 400 })
    }
    const id = crypto.randomUUID()
    const encryptedKey = encrypt(body.apiKey)
    db.prepare(`
      INSERT INTO ai_providers (id, name, api_key_encrypted, model, base_url, enabled)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, body.name, encryptedKey, body.model, body.baseUrl ?? null, body.enabled ? 1 : 0)

    return NextResponse.json({ success: true }, { status: 201 })
  }
}

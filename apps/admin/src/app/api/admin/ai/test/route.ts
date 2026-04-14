export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/encryption'

interface AiProvider {
  api_key_encrypted: string
  name: string
  model: string
  base_url: string | null
}

// POST /api/admin/ai/test — test provider connection
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const provider = db
    .prepare('SELECT * FROM ai_providers ORDER BY created_at DESC LIMIT 1')
    .get() as AiProvider | undefined

  if (!provider) {
    return NextResponse.json({ error: 'No provider configured' }, { status: 400 })
  }

  let apiKey: string
  try {
    apiKey = decrypt(provider.api_key_encrypted)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt API key' }, { status: 500 })
  }

  const baseUrl = provider.base_url ?? getDefaultBaseUrl(provider.name)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const res = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      return NextResponse.json({ success: true, status: 'connected' })
    }
    const body = await res.text()
    return NextResponse.json(
      { success: false, status: 'error', detail: `HTTP ${res.status}: ${body.slice(0, 200)}` },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, status: 'error', detail: message }, { status: 200 })
  }
}

function getDefaultBaseUrl(name: string): string {
  if (name.toLowerCase().includes('anthropic')) {
    return 'https://api.anthropic.com/v1'
  }
  return 'https://api.openai.com/v1'
}

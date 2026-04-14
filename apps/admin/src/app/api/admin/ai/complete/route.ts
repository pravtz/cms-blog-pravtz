export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import crypto from 'crypto'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Rough token estimate: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// POST /api/admin/ai/complete — get AI autocomplete suggestion
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const userId = auth.payload.sub

  const db = getDb()
  const month = currentMonth()

  // Check if AI is enabled for this user
  const quota = db.prepare(`
    SELECT q.ai_enabled, q.monthly_tokens, COALESCE(u.tokens_used, 0) as tokens_used
    FROM ai_user_quotas q
    LEFT JOIN (
      SELECT user_id, tokens_used FROM ai_usage WHERE user_id = ? AND month = ?
    ) u ON u.user_id = q.user_id
    WHERE q.user_id = ?
  `).get(userId, month, userId) as { ai_enabled: number; monthly_tokens: number; tokens_used: number } | undefined

  if (!quota || !quota.ai_enabled) {
    return NextResponse.json({ error: 'AI is not enabled for your account.' }, { status: 403 })
  }

  if (quota.tokens_used >= quota.monthly_tokens) {
    return NextResponse.json({ error: 'Monthly token quota exceeded.' }, { status: 429 })
  }

  // Get active provider
  const provider = db.prepare(`
    SELECT * FROM ai_providers WHERE enabled = 1 ORDER BY created_at DESC LIMIT 1
  `).get() as {
    id: string
    name: string
    api_key_encrypted: string
    model: string
    base_url: string | null
  } | undefined

  if (!provider) {
    return NextResponse.json({ error: 'No active AI provider configured.' }, { status: 503 })
  }

  const body = await request.json() as {
    context: string
    title?: string
    category?: string
    language?: string
  }

  if (!body.context) {
    return NextResponse.json({ error: 'context is required' }, { status: 400 })
  }

  const apiKey = decrypt(provider.api_key_encrypted)

  // Build prompt
  const systemPrompt = [
    'You are a writing assistant helping create blog content.',
    body.language === 'pt-BR'
      ? 'Continue the text in Portuguese (pt-BR).'
      : 'Continue the text in English.',
    body.title ? `Post title: "${body.title}"` : '',
    body.category ? `Category: "${body.category}"` : '',
    'Rules:',
    '- Write a natural continuation of at most 2 sentences.',
    '- Do not repeat the existing text.',
    '- Do not add headings, bullet points, or Markdown formatting.',
    '- Output ONLY the continuation text, nothing else.',
  ]
    .filter(Boolean)
    .join(' ')

  // Limit context to ~500 tokens (~2000 chars)
  const trimmedContext = body.context.slice(-2000)

  let suggestion = ''
  let tokensUsed = 0

  try {
    if (provider.name === 'Anthropic') {
      // Anthropic Messages API
      const baseUrl = provider.base_url ?? 'https://api.anthropic.com'
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 150,
          system: systemPrompt,
          messages: [{ role: 'user', content: trimmedContext }],
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        console.error('Anthropic API error:', err)
        return NextResponse.json({ error: 'AI provider error.' }, { status: 502 })
      }

      const data = await response.json() as {
        content: { type: string; text: string }[]
        usage: { input_tokens: number; output_tokens: number }
      }
      suggestion = data.content.find((c) => c.type === 'text')?.text ?? ''
      tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
    } else {
      // OpenAI-compatible API
      const baseUrl = provider.base_url ?? 'https://api.openai.com'
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 150,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: trimmedContext },
          ],
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        console.error('OpenAI API error:', err)
        return NextResponse.json({ error: 'AI provider error.' }, { status: 502 })
      }

      const data = await response.json() as {
        choices: { message: { content: string } }[]
        usage: { total_tokens: number }
      }
      suggestion = data.choices?.[0]?.message?.content ?? ''
      tokensUsed = data.usage?.total_tokens ?? estimateTokens(trimmedContext + suggestion)
    }
  } catch (err) {
    console.error('AI completion error:', err)
    return NextResponse.json({ error: 'AI provider unreachable.' }, { status: 502 })
  }

  suggestion = suggestion.trim()

  if (tokensUsed > 0) {
    // Upsert ai_usage
    const existing = db.prepare(
      'SELECT id, tokens_used FROM ai_usage WHERE user_id = ? AND month = ?'
    ).get(userId, month) as { id: string; tokens_used: number } | undefined

    if (existing) {
      db.prepare('UPDATE ai_usage SET tokens_used = tokens_used + ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(tokensUsed, existing.id)
    } else {
      db.prepare('INSERT INTO ai_usage (id, user_id, tokens_used, month) VALUES (?, ?, ?, ?)')
        .run(crypto.randomUUID(), userId, tokensUsed, month)
    }
  }

  const newUsed = (quota.tokens_used ?? 0) + tokensUsed

  return NextResponse.json({
    suggestion,
    tokensUsed,
    totalUsedToday: newUsed,
    monthlyLimit: quota.monthly_tokens,
  })
}

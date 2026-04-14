export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import crypto from 'crypto'

// Token cost estimate per image generation (DALL-E equivalent)
const TOKENS_PER_IMAGE = 500

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// Map aspect ratio to DALL-E size
function aspectRatioToSize(ar: string): string {
  switch (ar) {
    case '1:1': return '1024x1024'
    case '16:9': return '1792x1024'
    case '9:16': return '1024x1792'
    default: return '1024x1024'
  }
}

// Build enriched prompt with style
function buildPrompt(prompt: string, style: string | undefined): string {
  if (!style) return prompt
  const styleDesc: Record<string, string> = {
    Photographic: 'photorealistic photography style, high detail, professional photo',
    Illustration: 'digital illustration style, artistic, clean lines, vibrant colors',
    Abstract: 'abstract art style, creative, non-representational, artistic composition',
  }
  const styleHint = styleDesc[style]
  return styleHint ? `${prompt}. Style: ${styleHint}.` : prompt
}

// POST /api/admin/ai/generate-images — generate 4 image variations
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const userId = auth.payload.sub
  const db = getDb()
  const month = currentMonth()

  // Check AI enabled for user
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

  const totalCost = TOKENS_PER_IMAGE * 4
  if (quota.tokens_used + totalCost > quota.monthly_tokens) {
    return NextResponse.json({ error: 'Monthly token quota would be exceeded.' }, { status: 429 })
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

  if (provider.name === 'Anthropic') {
    return NextResponse.json(
      { error: 'Image generation is not supported with the Anthropic provider. Configure an OpenAI-compatible provider.' },
      { status: 422 }
    )
  }

  const body = await request.json() as {
    prompt: string
    aspectRatio?: string
    style?: string
  }

  if (!body.prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const apiKey = decrypt(provider.api_key_encrypted)
  const baseUrl = provider.base_url ?? 'https://api.openai.com'
  const size = aspectRatioToSize(body.aspectRatio ?? '1:1')
  const enrichedPrompt = buildPrompt(body.prompt.trim(), body.style)

  // Generate 4 images in parallel (DALL-E 3 supports n=1 per request)
  const imageUrls: string[] = []
  const errors: string[] = []

  const generateOne = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${baseUrl}/v1/images/generations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: enrichedPrompt,
          n: 1,
          size,
          response_format: 'url',
        }),
      })

      if (!res.ok) {
        // Try DALL-E 2 fallback (supports n > 1 but we standardize to 1 per call)
        const errText = await res.text()
        console.error('Image generation error:', errText)
        return null
      }

      const data = await res.json() as { data: { url: string }[] }
      return data.data?.[0]?.url ?? null
    } catch (err) {
      console.error('Image generation fetch error:', err)
      return null
    }
  }

  // Run 4 in parallel
  const results = await Promise.allSettled([
    generateOne(),
    generateOne(),
    generateOne(),
    generateOne(),
  ])

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      imageUrls.push(r.value)
    } else {
      errors.push('One generation failed')
    }
  }

  if (imageUrls.length === 0) {
    return NextResponse.json({ error: 'All image generations failed. Check your AI provider configuration.' }, { status: 502 })
  }

  // Charge tokens (proportional to successful generations)
  const tokensCharged = TOKENS_PER_IMAGE * imageUrls.length

  const existing = db.prepare(
    'SELECT id, tokens_used FROM ai_usage WHERE user_id = ? AND month = ?'
  ).get(userId, month) as { id: string; tokens_used: number } | undefined

  if (existing) {
    db.prepare("UPDATE ai_usage SET tokens_used = tokens_used + ?, updated_at = datetime('now') WHERE id = ?")
      .run(tokensCharged, existing.id)
  } else {
    db.prepare('INSERT INTO ai_usage (id, user_id, tokens_used, month) VALUES (?, ?, ?, ?)')
      .run(crypto.randomUUID(), userId, tokensCharged, month)
  }

  // Generate alt text suggestion using the prompt
  const altTextSuggestion = body.prompt.trim().slice(0, 120)

  const newUsed = (quota.tokens_used ?? 0) + tokensCharged

  return NextResponse.json({
    images: imageUrls,
    altTextSuggestion,
    tokensCharged,
    totalUsed: newUsed,
    monthlyLimit: quota.monthly_tokens,
    prompt: body.prompt,
    style: body.style ?? null,
    aspectRatio: body.aspectRatio ?? '1:1',
  })
}

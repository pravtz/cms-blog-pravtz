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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface PostRow {
  id: string
  title: string
  views: number
  category_name: string | null
  tags: string
  publish_date: string | null
  created_at: string
}

interface TrendResult {
  topic: string
  score: number
  justification: string
  suggestedTitle?: string
}

interface TrendsReport {
  growing: TrendResult[]
  declining: TrendResult[]
  gaps: TrendResult[]
  tokensUsed: number
  monthlyLimit: number
  totalUsed: number
}

// POST /api/admin/ai/trends — analyze content trends and generate AI report
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
    categoryId?: string
    timeWindow?: number
  }

  const timeWindow = body.timeWindow && [7, 30, 90].includes(body.timeWindow)
    ? body.timeWindow
    : 30

  // Query published posts within the time window
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - timeWindow)
  const cutoff = cutoffDate.toISOString().split('T')[0]

  const categoryFilter = body.categoryId ? 'AND p.category_id = ?' : ''
  const queryParams: (string | number)[] = body.categoryId
    ? [cutoff, body.categoryId]
    : [cutoff]

  const posts = db.prepare(`
    SELECT
      p.id,
      p.title,
      p.views,
      c.name AS category_name,
      GROUP_CONCAT(t.name, ', ') AS tags,
      p.publish_date,
      p.created_at
    FROM posts p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN post_tags pt ON pt.post_id = p.id
    LEFT JOIN tags t ON t.id = pt.tag_id
    WHERE p.status = 'published'
      AND (p.publish_date >= ? OR (p.publish_date IS NULL AND p.created_at >= ?))
      ${categoryFilter}
    GROUP BY p.id
    ORDER BY p.views DESC
    LIMIT 50
  `).all(cutoff, cutoff, ...(body.categoryId ? [body.categoryId] : [])) as PostRow[]

  // Also fetch all categories for context
  const allCategories = db.prepare('SELECT name FROM categories ORDER BY name').all() as { name: string }[]

  // All tags used in the period
  const allTags = db.prepare(`
    SELECT t.name, COUNT(pt.post_id) AS usage_count
    FROM tags t
    JOIN post_tags pt ON pt.tag_id = t.id
    JOIN posts p ON p.id = pt.post_id
    WHERE p.status = 'published'
    GROUP BY t.id
    ORDER BY usage_count DESC
    LIMIT 30
  `).all() as { name: string; usage_count: number }[]

  // Build the data summary for the AI prompt
  const postSummaries = posts.map((p, i) =>
    `${i + 1}. "${p.title}" | Category: ${p.category_name ?? 'None'} | Tags: ${p.tags ?? 'none'} | Views: ${p.views} | Published: ${p.publish_date ?? p.created_at.split('T')[0]}`
  ).join('\n')

  const tagSummary = allTags
    .map((t) => `${t.name} (${t.usage_count} posts)`)
    .join(', ')

  const categorySummary = allCategories.map((c) => c.name).join(', ')

  const systemPrompt = `You are a content strategy analyst for a blog. Analyze the provided data and identify trends.
Return a valid JSON object with exactly this structure (no markdown, no code blocks, only the JSON):
{
  "growing": [
    {"topic": "string", "score": 0-10, "justification": "string", "suggestedTitle": "string"}
  ],
  "declining": [
    {"topic": "string", "score": 0-10, "justification": "string"}
  ],
  "gaps": [
    {"topic": "string", "score": 0-10, "justification": "string", "suggestedTitle": "string"}
  ]
}
Rules:
- Provide exactly 5 items in each array.
- "growing": topics with increasing relevance, view momentum, or high engagement.
- "declining": topics that appear outdated, low-views, or underperforming.
- "gaps": content opportunities not yet covered or underexplored.
- "score": 0-10 relevance/opportunity score.
- "justification": 1-2 sentences explaining the insight.
- "suggestedTitle": a concrete blog post title for growing/gap topics.
- All text in the same language as the majority of the post titles.
- Be specific and actionable.`

  const userMessage = `Blog data for the last ${timeWindow} days:

Published posts (${posts.length} total, sorted by views):
${postSummaries || 'No posts in this period.'}

All available categories: ${categorySummary || 'None'}
Top tags by usage: ${tagSummary || 'None'}

Analyze this data and identify the top 5 growing topics, top 5 declining topics, and top 5 content gaps.`

  const apiKey = decrypt(provider.api_key_encrypted)
  let reportJson = ''
  let tokensUsed = 0

  try {
    if (provider.name === 'Anthropic') {
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
          max_tokens: 1500,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
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
      reportJson = data.content.find((c) => c.type === 'text')?.text ?? ''
      tokensUsed = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
    } else {
      // OpenAI-compatible
      const baseUrl = provider.base_url ?? 'https://api.openai.com'
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          max_tokens: 1500,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
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
      reportJson = data.choices?.[0]?.message?.content ?? ''
      tokensUsed = data.usage?.total_tokens ?? estimateTokens(userMessage + reportJson)
    }
  } catch (err) {
    console.error('AI trends error:', err)
    return NextResponse.json({ error: 'AI provider unreachable.' }, { status: 502 })
  }

  // Parse the JSON report
  let report: { growing: TrendResult[]; declining: TrendResult[]; gaps: TrendResult[] }
  try {
    // Strip markdown code fences if present
    const cleaned = reportJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    report = JSON.parse(cleaned) as { growing: TrendResult[]; declining: TrendResult[]; gaps: TrendResult[] }
  } catch {
    console.error('Failed to parse AI trends response:', reportJson)
    return NextResponse.json({ error: 'AI returned an invalid response. Please try again.' }, { status: 502 })
  }

  // Charge tokens to user quota
  if (tokensUsed > 0) {
    const existing = db.prepare(
      'SELECT id, tokens_used FROM ai_usage WHERE user_id = ? AND month = ?'
    ).get(userId, month) as { id: string; tokens_used: number } | undefined

    if (existing) {
      db.prepare("UPDATE ai_usage SET tokens_used = tokens_used + ?, updated_at = datetime('now') WHERE id = ?")
        .run(tokensUsed, existing.id)
    } else {
      db.prepare('INSERT INTO ai_usage (id, user_id, tokens_used, month) VALUES (?, ?, ?, ?)')
        .run(crypto.randomUUID(), userId, tokensUsed, month)
    }
  }

  const newUsed = (quota.tokens_used ?? 0) + tokensUsed

  const result: TrendsReport = {
    growing: (report.growing ?? []).slice(0, 5),
    declining: (report.declining ?? []).slice(0, 5),
    gaps: (report.gaps ?? []).slice(0, 5),
    tokensUsed,
    monthlyLimit: quota.monthly_tokens,
    totalUsed: newUsed,
  }

  return NextResponse.json(result)
}

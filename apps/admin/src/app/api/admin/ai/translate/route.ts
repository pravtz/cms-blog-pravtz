export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { decrypt } from '@/lib/encryption'
import { sanitizeMDX } from '@/lib/mdx'
import { slugify, uniqueSlug, calculateReadingTime } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface TranslationResult {
  title: string
  subtitle: string | null
  excerpt: string | null
  content: string
}

interface PostRow {
  id: string
  title: string
  subtitle: string | null
  excerpt: string | null
  content: string
  language: string
  category_id: string | null
  cover_image: string | null
  seo_title: string | null
  seo_description: string | null
  translation_group_id: string | null
  visibility: string
}

// POST /api/admin/ai/translate — translate a pt-BR post to EN draft
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

  const body = await request.json() as { postId: string }

  if (!body.postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  // Fetch source post
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(body.postId) as PostRow | undefined

  if (!post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
  }

  if (post.language !== 'pt-BR') {
    return NextResponse.json({ error: 'Translation is only supported for pt-BR posts.' }, { status: 400 })
  }

  const apiKey = decrypt(provider.api_key_encrypted)

  // Build translation prompt
  const systemPrompt = `You are a professional translator specializing in blog content translation from Brazilian Portuguese (pt-BR) to English (en).
Translate the provided blog post content accurately and naturally, preserving:
- Markdown formatting (headings, bold, italic, links, code blocks, lists, etc.)
- MDX components like :::info, :::warning, :::danger, :::success callouts
- Technical terms and proper nouns where appropriate
- The author's voice and style

Return a valid JSON object with exactly this structure (no markdown, no code blocks, only the JSON):
{
  "title": "translated title",
  "subtitle": "translated subtitle or null",
  "excerpt": "translated excerpt or null",
  "content": "full translated MDX content"
}

Rules:
- Translate ALL text to English, including the content field
- Keep all Markdown/MDX syntax intact
- "subtitle" and "excerpt" should be null if the original is null or empty
- Do NOT add any explanation or commentary outside the JSON`

  const userMessage = `Translate this Brazilian Portuguese blog post to English:

Title: ${post.title}
Subtitle: ${post.subtitle ?? '(none)'}
Excerpt: ${post.excerpt ?? '(none)'}

Content:
${post.content}`

  let translationJson = ''
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
          max_tokens: 4096,
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
      translationJson = data.content.find((c) => c.type === 'text')?.text ?? ''
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
          max_tokens: 4096,
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
      translationJson = data.choices?.[0]?.message?.content ?? ''
      tokensUsed = data.usage?.total_tokens ?? estimateTokens(userMessage + translationJson)
    }
  } catch (err) {
    console.error('AI translation error:', err)
    return NextResponse.json({ error: 'AI provider unreachable.' }, { status: 502 })
  }

  // Parse the translation JSON
  let translation: TranslationResult
  try {
    const cleaned = translationJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    translation = JSON.parse(cleaned) as TranslationResult
  } catch {
    console.error('Failed to parse AI translation response:', translationJson)
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

  // Create translation group if needed
  const translationGroupId = post.translation_group_id ?? uuidv4()

  // Create the new EN draft post
  const newPostId = uuidv4()
  const safeContent = sanitizeMDX(translation.content ?? '')
  const readingTime = calculateReadingTime(safeContent)
  const baseSlug = translation.title ? slugify(translation.title) : 'untitled'
  const slug = uniqueSlug(baseSlug)

  db.transaction(() => {
    // Ensure source post has a translation_group_id
    db.prepare("UPDATE posts SET translation_group_id = ?, updated_at = datetime('now') WHERE id = ?")
      .run(translationGroupId, post.id)

    // Insert the translated draft
    db.prepare(`
      INSERT INTO posts (
        id, title, subtitle, slug, excerpt, content, status, visibility,
        language, author_id, category_id, cover_image, reading_time,
        seo_title, seo_description, translation_group_id, ai_translated
      ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, 'en', ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      newPostId,
      translation.title ?? '',
      translation.subtitle ?? null,
      slug,
      translation.excerpt ?? null,
      safeContent,
      post.visibility,
      userId,
      post.category_id ?? null,
      post.cover_image ?? null,
      readingTime,
      post.seo_title ? `${post.seo_title} (EN)` : null,
      post.seo_description ?? null,
      translationGroupId,
    )
  })()

  logAudit({
    action: 'post.created',
    actorId: userId,
    actorEmail: auth.payload.email,
    targetId: newPostId,
    targetType: 'post',
    metadata: { title: translation.title, language: 'en', aiTranslated: true, sourcePostId: post.id },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({
    newPostId,
    tokensUsed,
    totalUsed: newUsed,
    monthlyLimit: quota.monthly_tokens,
  })
}

// GET /api/admin/ai/translate/estimate — estimate token cost for translation
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('postId')

  if (!postId) {
    return NextResponse.json({ error: 'postId is required' }, { status: 400 })
  }

  const db = getDb()
  const post = db.prepare('SELECT title, subtitle, excerpt, content FROM posts WHERE id = ?')
    .get(postId) as { title: string; subtitle: string | null; excerpt: string | null; content: string } | undefined

  if (!post) {
    return NextResponse.json({ error: 'Post not found.' }, { status: 404 })
  }

  const totalChars = (post.title?.length ?? 0)
    + (post.subtitle?.length ?? 0)
    + (post.excerpt?.length ?? 0)
    + (post.content?.length ?? 0)

  const estimatedTokens = estimateTokens(totalChars.toString()) * 4 + Math.ceil(totalChars / 4)
  // More accurate estimate: input tokens (content) + overhead + output tokens (similar size)
  const inputTokens = Math.ceil(totalChars / 4)
  const estimatedTotal = inputTokens * 2 + 500 // ~2x for input+output + overhead

  return NextResponse.json({ estimatedTokens: estimatedTotal })
}

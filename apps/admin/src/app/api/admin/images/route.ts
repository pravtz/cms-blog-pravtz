export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import crypto from 'crypto'

interface ImageRow {
  id: string
  url: string
  alt_text: string
  ai_generated: number
  prompt: string | null
  style: string | null
  aspect_ratio: string | null
  created_by: string
  created_by_name: string
  created_at: string
}

function mapImage(row: ImageRow) {
  return {
    id: row.id,
    url: row.url,
    altText: row.alt_text,
    aiGenerated: Boolean(row.ai_generated),
    prompt: row.prompt,
    style: row.style,
    aspectRatio: row.aspect_ratio,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
  }
}

// GET /api/admin/images — list images
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 24
  const offset = (page - 1) * limit
  const aiOnly = searchParams.get('aiOnly') === 'true'

  const db = getDb()

  const where = aiOnly ? 'WHERE i.ai_generated = 1' : ''
  const rows = db.prepare(`
    SELECT i.*, u.name as created_by_name
    FROM images i
    LEFT JOIN users u ON u.id = i.created_by
    ${where}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset) as ImageRow[]

  const total = (db.prepare(`SELECT COUNT(*) as cnt FROM images ${where}`).get() as { cnt: number }).cnt

  return NextResponse.json({
    images: rows.map(mapImage),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

// POST /api/admin/images — save image to library
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const userId = auth.payload.sub

  const body = await request.json() as {
    url: string
    altText?: string
    aiGenerated?: boolean
    prompt?: string
    style?: string
    aspectRatio?: string
  }

  if (!body.url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const db = getDb()
  const id = crypto.randomUUID()

  db.prepare(`
    INSERT INTO images (id, url, alt_text, ai_generated, prompt, style, aspect_ratio, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    body.url,
    body.altText ?? '',
    body.aiGenerated ? 1 : 0,
    body.prompt ?? null,
    body.style ?? null,
    body.aspectRatio ?? null,
    userId,
  )

  const row = db.prepare(`
    SELECT i.*, u.name as created_by_name
    FROM images i LEFT JOIN users u ON u.id = i.created_by WHERE i.id = ?
  `).get(id) as ImageRow

  return NextResponse.json(mapImage(row), { status: 201 })
}

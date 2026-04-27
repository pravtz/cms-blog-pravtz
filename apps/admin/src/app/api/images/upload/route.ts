export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
}

const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const userId = auth.payload.sub

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart/form-data request' }, { status: 400 })
  }

  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided. Use field name "file".' }, { status: 400 })
  }

  if (!ALLOWED_TYPES[file.type]) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed types: jpg, png, gif, webp, svg.' },
      { status: 400 },
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10 MB.' },
      { status: 413 },
    )
  }

  const ext = ALLOWED_TYPES[file.type]
  const filename = `${crypto.randomUUID()}.${ext}`

  const dataDir = process.env.DATA_DIR ?? './data'
  const uploadDir = path.join(dataDir, 'images')
  fs.mkdirSync(uploadDir, { recursive: true })

  const filePath = path.join(uploadDir, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filePath, buffer)

  const url = `/api/uploads/images/${filename}`

  const db = getDb()
  const id = crypto.randomUUID()

  db.prepare(`
    INSERT INTO images (id, url, alt_text, ai_generated, prompt, style, aspect_ratio, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, url, '', 0, null, null, null, userId)

  return NextResponse.json({ url, id, filename }, { status: 201 })
}

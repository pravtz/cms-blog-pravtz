export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const segments: string[] = params.path ?? []

  const dataDir = process.env.DATA_DIR ?? './data'
  const resolvedDataDir = path.resolve(dataDir)

  // Reconstruct path and check for traversal
  const joined = path.join(resolvedDataDir, ...segments)
  const resolvedFile = path.resolve(joined)

  if (!resolvedFile.startsWith(resolvedDataDir + path.sep) && resolvedFile !== resolvedDataDir) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  if (!fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const ext = path.extname(resolvedFile).slice(1).toLowerCase()
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'

  const buffer = fs.readFileSync(resolvedFile)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

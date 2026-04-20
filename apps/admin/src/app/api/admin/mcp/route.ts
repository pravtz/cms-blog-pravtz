export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

// List all MCP API keys (Owner only)
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const keys = db
    .prepare(
      `SELECT id, name, key_prefix, last_used_at, revoked, created_at
       FROM mcp_api_keys
       WHERE revoked = 0
       ORDER BY created_at DESC`
    )
    .all() as {
    id: string
    name: string
    key_prefix: string
    last_used_at: string | null
    revoked: number
    created_at: string
  }[]

  return NextResponse.json({ keys })
}

// Create a new MCP API key (Owner only)
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const name = (body.name ?? '').trim()
  if (!name) {
    return NextResponse.json({ error: 'Key name is required.' }, { status: 400 })
  }

  const db = getDb()
  const id = crypto.randomUUID()

  // Generate a secure random key: "mcp_" prefix + 32 random bytes as hex
  const rawKey = `mcp_${crypto.randomBytes(32).toString('hex')}`
  const keyPrefix = rawKey.slice(0, 12) + '...'
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  db.prepare(
    `INSERT INTO mcp_api_keys (id, name, key_hash, key_prefix, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, name, keyHash, keyPrefix, auth.payload.sub)

  // Return the raw key ONCE — it will never be shown again
  return NextResponse.json({ id, name, key: rawKey, key_prefix: keyPrefix }, { status: 201 })
}

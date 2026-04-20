export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

// Revoke an MCP API key (Owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const key = db
    .prepare('SELECT id FROM mcp_api_keys WHERE id = ?')
    .get(params.id) as { id: string } | undefined

  if (!key) {
    return NextResponse.json({ error: 'API key not found.' }, { status: 404 })
  }

  db.prepare(`UPDATE mcp_api_keys SET revoked = 1 WHERE id = ?`).run(params.id)

  return NextResponse.json({ success: true })
}

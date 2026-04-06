export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { applyRateLimit, handleOptions } from '@/lib/v1-helpers'

export async function OPTIONS() {
  return handleOptions()
}

export async function GET(request: NextRequest) {
  const { headers, error } = await applyRateLimit(request)
  if (error) return error

  const db = getDb()

  const tags = db
    .prepare(
      `SELECT t.id, t.name, t.slug, t.created_at,
        COUNT(pt.post_id) AS post_count
       FROM tags t
       LEFT JOIN post_tags pt ON pt.tag_id = t.id
       LEFT JOIN posts p ON p.id = pt.post_id
         AND p.status = 'published' AND p.visibility = 'public'
       GROUP BY t.id
       ORDER BY t.name ASC`
    )
    .all() as Array<{ id: string; name: string; slug: string; created_at: string; post_count: number }>

  return NextResponse.json({ data: tags }, { headers })
}

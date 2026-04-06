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

  const categories = db
    .prepare(
      `SELECT c.id, c.name, c.slug, c.created_at,
        COUNT(p.id) AS post_count
       FROM categories c
       LEFT JOIN posts p ON p.category_id = c.id
         AND p.status = 'published' AND p.visibility = 'public'
       GROUP BY c.id
       ORDER BY c.name ASC`
    )
    .all() as Array<{ id: string; name: string; slug: string; created_at: string; post_count: number }>

  return NextResponse.json({ data: categories }, { headers })
}

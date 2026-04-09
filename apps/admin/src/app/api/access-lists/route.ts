export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const CreateListSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().nullable(),
  user_ids: z.array(z.string().uuid()).optional().default([]),
})

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const lists = db
    .prepare(
      `SELECT al.id, al.name, al.description, al.created_at,
        COUNT(alm.user_id) AS member_count
       FROM access_lists al
       LEFT JOIN access_list_members alm ON alm.list_id = al.id
       GROUP BY al.id
       ORDER BY al.name ASC`
    )
    .all()

  return NextResponse.json({ lists })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const parsed = CreateListSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { name, description, user_ids } = parsed.data
  const id = uuidv4()
  const db = getDb()

  const insertList = db.prepare(
    `INSERT INTO access_lists (id, name, description, created_by) VALUES (?, ?, ?, ?)`
  )
  const insertMember = db.prepare(
    `INSERT OR IGNORE INTO access_list_members (list_id, user_id) VALUES (?, ?)`
  )

  db.transaction(() => {
    insertList.run(id, name, description ?? null, auth.payload.sub)
    for (const userId of user_ids) {
      insertMember.run(id, userId)
    }
  })()

  return NextResponse.json({ list: { id, name, description } }, { status: 201 })
}

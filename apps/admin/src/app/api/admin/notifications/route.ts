export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  link: string | null
  read: number
  created_at: string
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const notifications = db.prepare(`
    SELECT id, user_id, type, title, message, link, read, created_at
    FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(auth.payload.sub) as NotificationRow[]

  const unreadCount = (db.prepare(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read = 0'
  ).get(auth.payload.sub) as { count: number }).count

  return NextResponse.json({ notifications, unreadCount })
}

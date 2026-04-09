/**
 * Test-only endpoint: resets the database to a clean state.
 * Only available when E2E_TESTING=true environment variable is set.
 * NEVER expose this in production.
 */
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  if (process.env.E2E_TESTING !== 'true') {
    return NextResponse.json({ error: 'Not available.' }, { status: 403 })
  }

  const db = getDb()

  // Delete all data in the correct order (foreign keys enabled)
  db.transaction(() => {
    db.prepare('DELETE FROM post_tags').run()
    db.prepare('DELETE FROM post_list_access').run()
    db.prepare('DELETE FROM post_group_access').run()
    db.prepare('DELETE FROM posts').run()
    db.prepare('DELETE FROM newsletter_subscribers').run()
    db.prepare('DELETE FROM user_interests').run()
    db.prepare('DELETE FROM user_permissions').run()
    db.prepare('DELETE FROM group_permissions').run()
    db.prepare('DELETE FROM group_members').run()
    db.prepare('DELETE FROM groups').run()
    db.prepare('DELETE FROM access_list_members').run()
    db.prepare('DELETE FROM access_lists').run()
    db.prepare('DELETE FROM categories').run()
    db.prepare('DELETE FROM tags').run()
    db.prepare('DELETE FROM audit_logs').run()
    db.prepare('DELETE FROM login_attempts').run()
    db.prepare('DELETE FROM settings').run()
    db.prepare('DELETE FROM users').run()
  })()

  return NextResponse.json({ ok: true, message: 'Database reset to clean state.' })
}

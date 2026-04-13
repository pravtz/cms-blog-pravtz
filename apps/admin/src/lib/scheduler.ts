import { getDb, createVersionSnapshot } from './db'

let started = false

export function startScheduler(): void {
  if (started) return
  started = true

  const tick = () => {
    try {
      publishScheduledPosts()
    } catch (err) {
      console.error('[scheduler] Error publishing scheduled posts:', err)
    }
  }

  // Run immediately, then every 60 seconds
  tick()
  setInterval(tick, 60_000)
  console.log('[scheduler] Started — checking for scheduled posts every 60s')
}

function publishScheduledPosts(): void {
  const db = getDb()
  const now = new Date().toISOString()

  // SQLite stores publish_date in ISO or datetime format; compare as strings
  // ISO string comparison works correctly: '2026-04-10T12:00:00.000Z' <= now
  const scheduled = db
    .prepare(
      `SELECT id, author_id FROM posts
       WHERE status = 'scheduled' AND publish_date IS NOT NULL AND publish_date <= ?`
    )
    .all(now) as { id: string; author_id: string }[]

  if (scheduled.length === 0) return

  const publish = db.prepare(
    `UPDATE posts SET status = 'published', updated_at = datetime('now') WHERE id = ?`
  )

  for (const { id, author_id } of scheduled) {
    publish.run(id)
    try {
      createVersionSnapshot(id, author_id, 'Auto-published (scheduled)')
    } catch {
      // Non-fatal: version snapshot failure shouldn't block publishing
    }
    console.log(`[scheduler] Published scheduled post: ${id}`)
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()

  const totalPosts = (db.prepare("SELECT COUNT(*) as n FROM posts WHERE status = 'published'").get() as { n: number }).n
  const draftPosts = (db.prepare("SELECT COUNT(*) as n FROM posts WHERE status = 'draft'").get() as { n: number }).n
  const totalUsers = (db.prepare("SELECT COUNT(*) as n FROM users WHERE status = 'active'").get() as { n: number }).n
  const pendingUsers = (db.prepare("SELECT COUNT(*) as n FROM users WHERE status = 'pending_approval'").get() as { n: number }).n
  const totalViews = (db.prepare("SELECT COALESCE(SUM(views), 0) as n FROM posts").get() as { n: number }).n
  const newsletterSubs = (db.prepare("SELECT COUNT(*) as n FROM newsletter_subscribers WHERE status = 'active'").get() as { n: number }).n

  const topPosts = db.prepare(`
    SELECT p.id, p.title, p.slug, p.views, p.updated_at, u.name as author_name
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE p.status = 'published'
    ORDER BY p.views DESC
    LIMIT 5
  `).all()

  const recentActivity = db.prepare(`
    SELECT id, actor_email, action, target_type, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT 20
  `).all()

  return NextResponse.json({
    metrics: {
      publishedPosts: totalPosts,
      draftPosts,
      activeUsers: totalUsers,
      pendingUsers,
      totalViews,
      newsletterSubscribers: newsletterSubs,
    },
    topPosts,
    recentActivity,
  })
}

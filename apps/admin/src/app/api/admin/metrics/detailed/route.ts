export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

function getPeriodDates(period: string, from?: string, to?: string): { startDate: string; endDate: string; days: number } {
  const end = to ? new Date(to) : new Date()
  end.setHours(23, 59, 59, 999)
  let start: Date
  let days: number

  switch (period) {
    case '7d':
      days = 7
      start = new Date(end)
      start.setDate(start.getDate() - 6)
      break
    case '30d':
      days = 30
      start = new Date(end)
      start.setDate(start.getDate() - 29)
      break
    case '3m':
      days = 90
      start = new Date(end)
      start.setDate(start.getDate() - 89)
      break
    case '12m':
      days = 365
      start = new Date(end)
      start.setDate(start.getDate() - 364)
      break
    case 'custom':
      start = from ? new Date(from) : new Date(end.getTime() - 29 * 86400000)
      days = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1
      break
    default:
      days = 30
      start = new Date(end)
      start.setDate(start.getDate() - 29)
  }

  start.setHours(0, 0, 0, 0)
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    days,
  }
}

function buildDateSeries(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const cur = new Date(startDate)
  const end = new Date(endDate)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function calcSeoScore(post: Record<string, unknown>): number {
  let score = 0
  const seoTitle = (post.seo_title as string) ?? ''
  const seoDesc = (post.seo_description as string) ?? ''
  const title = (post.title as string) ?? ''
  const excerpt = (post.excerpt as string) ?? ''

  if (seoTitle.length >= 10) score += 20
  else if (title.length >= 10) score += 10

  if (seoTitle.length >= 50 && seoTitle.length <= 60) score += 10
  else if (seoTitle.length > 0) score += 5

  if (seoDesc.length >= 120 && seoDesc.length <= 160) score += 20
  else if (seoDesc.length > 0) score += 10
  else if (excerpt.length > 0) score += 5

  if (post.cover_image) score += 20

  if ((post.reading_time as number) > 0) score += 15

  if (post.slug) score += 15

  return Math.min(score, 100)
}

export async function GET(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const period = searchParams.get('period') ?? '30d'
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined

  const { startDate, endDate } = getPeriodDates(period, from, to)
  const dateSeries = buildDateSeries(startDate, endDate)

  const db = getDb()

  // --- Time-series: views + unique visitors per day ---
  const dailyRows = db
    .prepare(
      `SELECT view_date, SUM(views) as views, SUM(unique_visitors) as unique_visitors
       FROM page_views_daily
       WHERE view_date >= ? AND view_date <= ?
       GROUP BY view_date
       ORDER BY view_date ASC`
    )
    .all(startDate, endDate) as Array<{ view_date: string; views: number; unique_visitors: number }>

  const dailyMap: Record<string, { views: number; unique_visitors: number }> = {}
  for (const row of dailyRows) {
    dailyMap[row.view_date] = { views: row.views, unique_visitors: row.unique_visitors }
  }

  const timeSeries = dateSeries.map((date) => ({
    date,
    views: dailyMap[date]?.views ?? 0,
    unique_visitors: dailyMap[date]?.unique_visitors ?? 0,
  }))

  // --- Top posts by views (all-time, not period-filtered — views is cumulative) ---
  const topPosts = db
    .prepare(
      `SELECT p.id, p.title, p.slug, p.views, p.category_id,
        c.name as category_name,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) as like_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.status = 'visible') as comment_count
       FROM posts p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.status = 'published'
       ORDER BY p.views DESC
       LIMIT 10`
    )
    .all() as Array<{
      id: string; title: string; slug: string; views: number
      category_name: string | null; like_count: number; comment_count: number
    }>

  // Engagement rate per post: (likes + comments) / views * 100
  const topPostsWithEngagement = topPosts.map((p) => ({
    ...p,
    engagement_rate: p.views > 0 ? Math.round(((p.like_count + p.comment_count) / p.views) * 100 * 10) / 10 : 0,
  }))

  // --- Traffic sources breakdown ---
  const sourceRows = db
    .prepare(
      `SELECT traffic_source, SUM(views) as views
       FROM page_views_daily
       WHERE view_date >= ? AND view_date <= ?
       GROUP BY traffic_source`
    )
    .all(startDate, endDate) as Array<{ traffic_source: string; views: number }>

  const totalSourceViews = sourceRows.reduce((sum, r) => sum + r.views, 0)
  const trafficSources = ['organic', 'direct', 'referral', 'social'].map((source) => {
    const row = sourceRows.find((r) => r.traffic_source === source)
    const views = row?.views ?? 0
    return {
      source,
      views,
      percentage: totalSourceViews > 0 ? Math.round((views / totalSourceViews) * 100) : 0,
    }
  })

  // --- Newsletter subscriber growth ---
  const newsletterRows = db
    .prepare(
      `SELECT substr(confirmed_at, 1, 10) as day, COUNT(*) as new_subscribers
       FROM newsletter_subscribers
       WHERE status = 'active'
         AND confirmed_at >= ? AND confirmed_at <= ?
       GROUP BY day
       ORDER BY day ASC`
    )
    .all(startDate + 'T00:00:00.000Z', endDate + 'T23:59:59.999Z') as Array<{ day: string; new_subscribers: number }>

  const newsletterMap: Record<string, number> = {}
  for (const row of newsletterRows) {
    newsletterMap[row.day] = row.new_subscribers
  }
  const totalActiveSubscribers = (
    db.prepare("SELECT COUNT(*) as n FROM newsletter_subscribers WHERE status = 'active'").get() as { n: number }
  ).n
  const newsletterGrowth = dateSeries.map((date) => ({
    date,
    new_subscribers: newsletterMap[date] ?? 0,
  }))

  // --- SEO scores per published post ---
  const publishedPosts = db
    .prepare(
      `SELECT id, title, slug, seo_title, seo_description, cover_image, reading_time, excerpt, views
       FROM posts
       WHERE status = 'published'
       ORDER BY views DESC
       LIMIT 20`
    )
    .all() as Array<Record<string, unknown>>

  const seoScores = publishedPosts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    views: p.views,
    seo_score: calcSeoScore(p),
  }))

  // --- Overall engagement rate ---
  const totalViews = (db.prepare('SELECT COALESCE(SUM(views), 0) as n FROM posts').get() as { n: number }).n
  const totalLikes = (db.prepare('SELECT COUNT(*) as n FROM post_likes').get() as { n: number }).n
  const totalComments = (
    db.prepare("SELECT COUNT(*) as n FROM comments WHERE status = 'visible'").get() as { n: number }
  ).n
  const overallEngagementRate =
    totalViews > 0 ? Math.round(((totalLikes + totalComments) / totalViews) * 100 * 100) / 100 : 0

  // Engagement over time (likes + comments per day proxied via daily view data)
  const engagementTimeSeries = timeSeries.map((d) => ({
    date: d.date,
    views: d.views,
    engagement_rate: 0, // No per-day likes/comments tracking yet — placeholder
  }))

  return NextResponse.json({
    period,
    startDate,
    endDate,
    timeSeries,
    topPosts: topPostsWithEngagement,
    trafficSources,
    newsletterGrowth,
    totalActiveSubscribers,
    seoScores,
    summary: {
      totalViews,
      totalLikes,
      totalComments,
      overallEngagementRate,
      totalActiveSubscribers,
      periodViews: timeSeries.reduce((s, d) => s + d.views, 0),
      periodUniqueVisitors: timeSeries.reduce((s, d) => s + d.unique_visitors, 0),
    },
    engagementTimeSeries,
  })
}

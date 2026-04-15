export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'
import nodemailer from 'nodemailer'
import { getSetting } from '@/lib/db'
import { getNotificationSettings } from '@/lib/channel-notifications'

function getTransporter() {
  const host = getSetting('smtp_host')
  const portStr = getSetting('smtp_port')
  const user = getSetting('smtp_user')
  const pass = getSetting('smtp_pass')
  if (!host || !portStr) return null
  return nodemailer.createTransport({
    host,
    port: Number(portStr),
    secure: Number(portStr) === 465,
    auth: user && pass ? { user, pass } : undefined,
  })
}

function getFromAddress() {
  return getSetting('smtp_from') ?? 'noreply@nexuscms.local'
}

function buildEmailHtml(summary: Record<string, unknown>, period: string, adminUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Nexus CMS Metrics Report</title></head>
<body style="font-family: Inter, sans-serif; background: #0f0f0f; color: #e2e2e2; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: #1a1a1a; border-radius: 8px; padding: 32px;">
    <h1 style="font-size: 22px; margin: 0 0 8px; color: #fff;">📊 Metrics Report</h1>
    <p style="margin: 0 0 24px; color: #888; font-size: 14px;">Period: ${period.toUpperCase()}</p>

    <div style="display: grid; gap: 16px; margin-bottom: 24px;">
      <div style="background: #252525; border-radius: 6px; padding: 16px;">
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Period Views</div>
        <div style="font-size: 28px; font-weight: 700; color: #fff;">${(summary.periodViews as number).toLocaleString()}</div>
      </div>
      <div style="background: #252525; border-radius: 6px; padding: 16px;">
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Unique Visitors</div>
        <div style="font-size: 28px; font-weight: 700; color: #fff;">${(summary.periodUniqueVisitors as number).toLocaleString()}</div>
      </div>
      <div style="background: #252525; border-radius: 6px; padding: 16px;">
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Total Likes</div>
        <div style="font-size: 28px; font-weight: 700; color: #fff;">${(summary.totalLikes as number).toLocaleString()}</div>
      </div>
      <div style="background: #252525; border-radius: 6px; padding: 16px;">
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Newsletter Subscribers</div>
        <div style="font-size: 28px; font-weight: 700; color: #fff;">${(summary.totalActiveSubscribers as number).toLocaleString()}</div>
      </div>
      <div style="background: #252525; border-radius: 6px; padding: 16px;">
        <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px;">Engagement Rate</div>
        <div style="font-size: 28px; font-weight: 700; color: #fff;">${summary.overallEngagementRate}%</div>
      </div>
    </div>

    <a href="${adminUrl}/admin/metrics" style="display: inline-block; background: #6366f1; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Full Dashboard →</a>

    <p style="margin: 24px 0 0; font-size: 12px; color: #555;">Nexus CMS · Automated metrics summary</p>
  </div>
</body>
</html>`
}

async function sendTeamsNotification(webhookUrl: string, summary: Record<string, unknown>, period: string, adminUrl: string) {
  const body = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: `📊 Nexus CMS Metrics — ${period.toUpperCase()}`, weight: 'Bolder', size: 'Medium' },
            { type: 'TextBlock', text: `Views: ${(summary.periodViews as number).toLocaleString()} | Visitors: ${(summary.periodUniqueVisitors as number).toLocaleString()} | Subscribers: ${(summary.totalActiveSubscribers as number).toLocaleString()}`, wrap: true },
          ],
          actions: [{ type: 'Action.OpenUrl', title: 'View Dashboard', url: `${adminUrl}/admin/metrics` }],
        },
      },
    ],
  }
  await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function sendSlackNotification(webhookUrl: string, summary: Record<string, unknown>, period: string, adminUrl: string) {
  const body = {
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*📊 Nexus CMS Metrics — ${period.toUpperCase()}*\nViews: *${(summary.periodViews as number).toLocaleString()}* | Visitors: *${(summary.periodUniqueVisitors as number).toLocaleString()}* | Subscribers: *${(summary.totalActiveSubscribers as number).toLocaleString()}*` } },
      { type: 'section', text: { type: 'mrkdwn', text: `<${adminUrl}/admin/metrics|View Full Dashboard>` } },
    ],
  }
  await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

async function sendDiscordNotification(webhookUrl: string, summary: Record<string, unknown>, period: string, adminUrl: string) {
  const content = `📊 **Nexus CMS Metrics — ${period.toUpperCase()}**\nViews: **${(summary.periodViews as number).toLocaleString()}** | Visitors: **${(summary.periodUniqueVisitors as number).toLocaleString()}** | Subscribers: **${(summary.totalActiveSubscribers as number).toLocaleString()}**\n${adminUrl}/admin/metrics`
  await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const db = getDb()
  const adminUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3001'

  const body = await request.json() as { period?: string; channels?: string[] }
  const period = body.period ?? '30d'
  const channels = body.channels ?? ['email']

  // Build summary
  const totalViews = (db.prepare('SELECT COALESCE(SUM(views), 0) as n FROM posts').get() as { n: number }).n
  const totalLikes = (db.prepare('SELECT COUNT(*) as n FROM post_likes').get() as { n: number }).n
  const totalComments = (db.prepare("SELECT COUNT(*) as n FROM comments WHERE status = 'visible'").get() as { n: number }).n
  const totalActiveSubscribers = (db.prepare("SELECT COUNT(*) as n FROM newsletter_subscribers WHERE status = 'active'").get() as { n: number }).n

  // Period views
  const end = new Date()
  let daysBack = 30
  if (period === '7d') daysBack = 7
  else if (period === '3m') daysBack = 90
  else if (period === '12m') daysBack = 365
  const startDate = new Date(end.getTime() - (daysBack - 1) * 86400000).toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const periodViews = (db.prepare(
    `SELECT COALESCE(SUM(views), 0) as n FROM page_views_daily WHERE view_date >= ? AND view_date <= ?`
  ).get(startDate, endDate) as { n: number }).n
  const periodUniqueVisitors = (db.prepare(
    `SELECT COALESCE(SUM(unique_visitors), 0) as n FROM page_views_daily WHERE view_date >= ? AND view_date <= ?`
  ).get(startDate, endDate) as { n: number }).n

  const overallEngagementRate = totalViews > 0
    ? Math.round(((totalLikes + totalComments) / totalViews) * 100 * 100) / 100
    : 0

  const summary: Record<string, unknown> = {
    periodViews,
    periodUniqueVisitors,
    totalViews,
    totalLikes,
    totalComments,
    totalActiveSubscribers,
    overallEngagementRate,
  }

  const results: Record<string, string> = {}
  const notifSettings = getNotificationSettings()

  // Email export — send to current user
  if (channels.includes('email')) {
    try {
      const transporter = getTransporter()
      if (!transporter) {
        results.email = 'SMTP not configured'
      } else {
        // Get user email from token payload
        const user = db.prepare('SELECT email, name FROM users WHERE id = ?').get(auth.payload.sub) as { email: string; name: string } | undefined
        if (user) {
          await transporter.sendMail({
            from: getFromAddress(),
            to: user.email,
            subject: `Nexus CMS Metrics Report — ${period.toUpperCase()}`,
            html: buildEmailHtml(summary, period, adminUrl),
          })
          results.email = 'sent'
        } else {
          results.email = 'user not found'
        }
      }
    } catch (err) {
      results.email = `error: ${(err as Error).message}`
    }
  }

  // Teams
  if (channels.includes('teams') && notifSettings.teams.enabled && notifSettings.teams.webhookUrl) {
    try {
      await sendTeamsNotification(notifSettings.teams.webhookUrl, summary, period, adminUrl)
      results.teams = 'sent'
    } catch (err) {
      results.teams = `error: ${(err as Error).message}`
    }
  }

  // Slack
  if (channels.includes('slack') && notifSettings.slack.enabled && notifSettings.slack.webhookUrl) {
    try {
      await sendSlackNotification(notifSettings.slack.webhookUrl, summary, period, adminUrl)
      results.slack = 'sent'
    } catch (err) {
      results.slack = `error: ${(err as Error).message}`
    }
  }

  // Discord
  if (channels.includes('discord') && notifSettings.discord.enabled && notifSettings.discord.webhookUrl) {
    try {
      await sendDiscordNotification(notifSettings.discord.webhookUrl, summary, period, adminUrl)
      results.discord = 'sent'
    } catch (err) {
      results.discord = `error: ${(err as Error).message}`
    }
  }

  return NextResponse.json({ ok: true, results, summary })
}

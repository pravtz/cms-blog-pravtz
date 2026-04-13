export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import {
  NotificationEvent,
  NotificationContext,
} from '@/lib/channel-notifications'

// Individual send functions for test
async function testTeams(webhookUrl: string, ctx: NotificationContext): Promise<void> {
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
            { type: 'TextBlock', text: ctx.title, weight: 'Bolder', size: 'Medium' },
            { type: 'TextBlock', text: ctx.message, wrap: true },
          ],
        },
      },
    ],
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Teams returned ${res.status}`)
}

async function testSlack(webhookUrl: string, ctx: NotificationContext): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*${ctx.title}*\n${ctx.message}` },
        },
      ],
    }),
  })
  if (!res.ok) throw new Error(`Slack returned ${res.status}`)
}

async function testDiscord(webhookUrl: string, ctx: NotificationContext): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: `**${ctx.title}**\n${ctx.message}` }),
  })
  if (!res.ok) throw new Error(`Discord returned ${res.status}`)
}

async function testEmail(ctx: NotificationContext): Promise<void> {
  const nodemailer = await import('nodemailer')
  const { getSetting, getDb } = await import('@/lib/db')

  const host = getSetting('smtp_host')
  const portStr = getSetting('smtp_port')
  const user = getSetting('smtp_user')
  const pass = getSetting('smtp_pass')
  const from = getSetting('smtp_from') ?? 'noreply@nexuscms.local'

  if (!host || !portStr) {
    throw new Error('SMTP not configured')
  }

  const db = getDb()
  const owner = db
    .prepare("SELECT email FROM users WHERE role = 'owner' LIMIT 1")
    .get() as { email: string } | undefined

  if (!owner) throw new Error('No owner email found')

  const transporter = nodemailer.default.createTransport({
    host,
    port: Number(portStr),
    secure: Number(portStr) === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  await transporter.sendMail({
    from,
    to: owner.email,
    subject: `[Nexus CMS Test] ${ctx.title}`,
    text: `${ctx.title}\n\n${ctx.message}`,
    html: `<p><strong>${ctx.title}</strong></p><p>${ctx.message}</p>`,
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const b = body as Record<string, unknown>
  const channel = b.channel as string
  const webhookUrl = b.webhookUrl as string | undefined

  const testCtx: NotificationContext = {
    title: 'Test Notification from Nexus CMS',
    message: `This is a test notification for the "${channel}" channel. If you received this, the integration is working correctly.`,
  }

  try {
    switch (channel) {
      case 'teams':
        if (!webhookUrl) return NextResponse.json({ error: 'webhookUrl required for Teams.' }, { status: 400 })
        await testTeams(webhookUrl, testCtx)
        break
      case 'slack':
        if (!webhookUrl) return NextResponse.json({ error: 'webhookUrl required for Slack.' }, { status: 400 })
        await testSlack(webhookUrl, testCtx)
        break
      case 'discord':
        if (!webhookUrl) return NextResponse.json({ error: 'webhookUrl required for Discord.' }, { status: 400 })
        await testDiscord(webhookUrl, testCtx)
        break
      case 'email':
        await testEmail(testCtx)
        break
      default:
        return NextResponse.json({ error: `Unknown channel: ${channel}` }, { status: 400 })
    }
    return NextResponse.json({ success: true, message: `Test notification sent to ${channel}.` })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `Failed to send test: ${message}` }, { status: 500 })
  }
}

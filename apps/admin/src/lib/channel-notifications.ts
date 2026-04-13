/**
 * Channel Notifications Service
 * Dispatches notifications to external channels (Teams, Slack, Discord, Email)
 * based on configured events in admin settings.
 */

import { getSetting } from './db'

export type NotificationEvent =
  | 'new_pending_user'
  | 'new_comment'
  | 'suspicious_login'
  | 'post_published'
  | 'critical_system_error'

export interface NotificationContext {
  title: string
  message: string
  link?: string
  metadata?: Record<string, unknown>
}

export interface ChannelConfig {
  enabled: boolean
  webhookUrl?: string
  events: NotificationEvent[]
}

export interface EmailChannelConfig {
  enabled: boolean
  events: NotificationEvent[]
}

export interface NotificationSettings {
  teams: ChannelConfig
  slack: ChannelConfig
  discord: ChannelConfig
  email: EmailChannelConfig
}

const DEFAULT_SETTINGS: NotificationSettings = {
  teams: { enabled: false, webhookUrl: '', events: [] },
  slack: { enabled: false, webhookUrl: '', events: [] },
  discord: { enabled: false, webhookUrl: '', events: [] },
  email: { enabled: false, events: [] },
}

export function getNotificationSettings(): NotificationSettings {
  try {
    const raw = getSetting('notification_channel_config')
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    }
  } catch {
    // Fall through to defaults
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveNotificationSettings(settings: NotificationSettings): void {
  const { setSetting } = require('./db') as typeof import('./db')
  setSetting('notification_channel_config', JSON.stringify(settings))
}

// --- Teams (Adaptive Cards) ---
async function sendTeamsNotification(
  webhookUrl: string,
  event: NotificationEvent,
  ctx: NotificationContext
): Promise<void> {
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
            {
              type: 'TextBlock',
              text: ctx.title,
              weight: 'Bolder',
              size: 'Medium',
            },
            {
              type: 'TextBlock',
              text: ctx.message,
              wrap: true,
            },
          ],
          actions: ctx.link
            ? [
                {
                  type: 'Action.OpenUrl',
                  title: 'View',
                  url: ctx.link,
                },
              ]
            : [],
        },
      },
    ],
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Teams webhook returned ${response.status}`)
  }
}

// --- Slack ---
async function sendSlackNotification(
  webhookUrl: string,
  event: NotificationEvent,
  ctx: NotificationContext
): Promise<void> {
  const blocks: unknown[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${ctx.title}*\n${ctx.message}`,
      },
    },
  ]

  if (ctx.link) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${ctx.link}|View in Nexus CMS>`,
      },
    })
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })

  if (!response.ok) {
    throw new Error(`Slack webhook returned ${response.status}`)
  }
}

// --- Discord ---
async function sendDiscordNotification(
  webhookUrl: string,
  event: NotificationEvent,
  ctx: NotificationContext
): Promise<void> {
  const content = ctx.link
    ? `**${ctx.title}**\n${ctx.message}\n${ctx.link}`
    : `**${ctx.title}**\n${ctx.message}`

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })

  if (!response.ok) {
    throw new Error(`Discord webhook returned ${response.status}`)
  }
}

// --- Email ---
async function sendEmailChannelNotification(
  event: NotificationEvent,
  ctx: NotificationContext
): Promise<void> {
  const nodemailer = await import('nodemailer')
  const { getSetting: gs } = await import('./db')

  const host = gs('smtp_host')
  const portStr = gs('smtp_port')
  const user = gs('smtp_user')
  const pass = gs('smtp_pass')
  const from = gs('smtp_from') ?? 'noreply@nexuscms.local'

  if (!host || !portStr) {
    console.warn('[channel-notifications] SMTP not configured — skipping email notification')
    return
  }

  // Get owner email as recipient
  const { getDb } = await import('./db')
  const db = getDb()
  const owner = db
    .prepare("SELECT email FROM users WHERE role = 'owner' LIMIT 1")
    .get() as { email: string } | undefined

  if (!owner) {
    console.warn('[channel-notifications] No owner found — skipping email notification')
    return
  }

  const transporter = nodemailer.default.createTransport({
    host,
    port: Number(portStr),
    secure: Number(portStr) === 465,
    auth: user && pass ? { user, pass } : undefined,
  })

  const linkHtml = ctx.link ? `<p><a href="${ctx.link}">View in Nexus CMS</a></p>` : ''

  await transporter.sendMail({
    from,
    to: owner.email,
    subject: `[Nexus CMS] ${ctx.title}`,
    text: `${ctx.title}\n\n${ctx.message}${ctx.link ? `\n\n${ctx.link}` : ''}`,
    html: `<p><strong>${ctx.title}</strong></p><p>${ctx.message}</p>${linkHtml}`,
  })
}

/**
 * Dispatch a notification event to all configured and enabled channels.
 * Non-blocking — errors are caught and logged, never thrown.
 */
export async function dispatchChannelNotification(
  event: NotificationEvent,
  ctx: NotificationContext
): Promise<void> {
  let settings: NotificationSettings
  try {
    settings = getNotificationSettings()
  } catch {
    return
  }

  const tasks: Promise<void>[] = []

  if (
    settings.teams.enabled &&
    settings.teams.webhookUrl &&
    settings.teams.events.includes(event)
  ) {
    tasks.push(
      sendTeamsNotification(settings.teams.webhookUrl, event, ctx).catch((err) =>
        console.error('[channel-notifications] Teams error:', err)
      )
    )
  }

  if (
    settings.slack.enabled &&
    settings.slack.webhookUrl &&
    settings.slack.events.includes(event)
  ) {
    tasks.push(
      sendSlackNotification(settings.slack.webhookUrl, event, ctx).catch((err) =>
        console.error('[channel-notifications] Slack error:', err)
      )
    )
  }

  if (
    settings.discord.enabled &&
    settings.discord.webhookUrl &&
    settings.discord.events.includes(event)
  ) {
    tasks.push(
      sendDiscordNotification(settings.discord.webhookUrl, event, ctx).catch((err) =>
        console.error('[channel-notifications] Discord error:', err)
      )
    )
  }

  if (settings.email.enabled && settings.email.events.includes(event)) {
    tasks.push(
      sendEmailChannelNotification(event, ctx).catch((err) =>
        console.error('[channel-notifications] Email channel error:', err)
      )
    )
  }

  await Promise.allSettled(tasks)
}

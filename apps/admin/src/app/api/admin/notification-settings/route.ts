export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import {
  getNotificationSettings,
  saveNotificationSettings,
  NotificationSettings,
  NotificationEvent,
} from '@/lib/channel-notifications'
import { logAudit } from '@/lib/audit'

const VALID_EVENTS: NotificationEvent[] = [
  'new_pending_user',
  'new_comment',
  'suspicious_login',
  'post_published',
  'critical_system_error',
]

function validateSettings(body: unknown): { valid: boolean; settings?: NotificationSettings; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body.' }
  }

  const b = body as Record<string, unknown>

  for (const channel of ['teams', 'slack', 'discord'] as const) {
    if (channel in b) {
      const cfg = b[channel] as Record<string, unknown>
      if (typeof cfg !== 'object' || cfg === null) {
        return { valid: false, error: `Invalid ${channel} config.` }
      }
      if ('events' in cfg && Array.isArray(cfg.events)) {
        for (const e of cfg.events) {
          if (!VALID_EVENTS.includes(e as NotificationEvent)) {
            return { valid: false, error: `Invalid event: ${e}` }
          }
        }
      }
    }
  }

  if ('email' in b) {
    const cfg = b.email as Record<string, unknown>
    if (typeof cfg !== 'object' || cfg === null) {
      return { valid: false, error: 'Invalid email config.' }
    }
    if ('events' in cfg && Array.isArray(cfg.events)) {
      for (const e of cfg.events) {
        if (!VALID_EVENTS.includes(e as NotificationEvent)) {
          return { valid: false, error: `Invalid event: ${e}` }
        }
      }
    }
  }

  return { valid: true, settings: body as NotificationSettings }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const settings = getNotificationSettings()
  // Mask webhook URLs: return only whether they are set
  return NextResponse.json({ settings })
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

  const { valid, settings, error } = validateSettings(body)
  if (!valid || !settings) {
    return NextResponse.json({ error }, { status: 400 })
  }

  saveNotificationSettings(settings)

  logAudit({
    action: 'settings.changed',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetType: 'notification_settings',
    metadata: { channels: Object.keys(settings) },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}

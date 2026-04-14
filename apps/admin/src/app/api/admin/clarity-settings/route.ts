export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import { getSetting, setSetting } from '@/lib/db'
import { logAudit } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  return NextResponse.json({
    enabled: getSetting('clarity_enabled') === 'true',
    projectId: getSetting('clarity_project_id') ?? '',
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

  if (typeof b.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean.' }, { status: 400 })
  }
  if (b.projectId !== undefined && typeof b.projectId !== 'string') {
    return NextResponse.json({ error: 'projectId must be a string.' }, { status: 400 })
  }

  const projectId = typeof b.projectId === 'string' ? b.projectId.trim() : ''

  setSetting('clarity_enabled', b.enabled ? 'true' : 'false')
  setSetting('clarity_project_id', projectId)

  logAudit({
    action: 'settings.changed',
    actorId: auth.payload.sub,
    actorEmail: auth.payload.email,
    targetType: 'clarity_settings',
    metadata: { enabled: b.enabled, projectId: projectId ? '[set]' : '[empty]' },
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    userAgent: request.headers.get('user-agent'),
  })

  return NextResponse.json({ success: true })
}

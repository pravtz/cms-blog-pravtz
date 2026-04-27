export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth-middleware'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  status: string
}

function corsHeaders(request: NextRequest) {
  const corsOrigin = request.headers.get('origin') ?? '*'
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

/**
 * GET /api/auth/me
 * Validates Bearer access token and returns the active user (for blog cross-origin when cookies are not sent).
 */
export async function GET(request: NextRequest) {
  const headers = corsHeaders(request)
  const auth = requireAuth(request)
  if (auth instanceof NextResponse) {
    const errBody = await auth.clone().json()
    return NextResponse.json(errBody, { status: auth.status, headers })
  }

  const db = getDb()
  const user = db
    .prepare(
      'SELECT id, name, email, role, status FROM users WHERE id = ? AND status = ?'
    )
    .get(auth.payload.sub, 'active') as UserRow | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 401, headers })
  }

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
    { headers }
  )
}

export async function OPTIONS(request: NextRequest) {
  const h = corsHeaders(request)
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...h,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
    },
  })
}

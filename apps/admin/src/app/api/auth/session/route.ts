export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getDb } from '@/lib/db'
import { generateToken } from '@/lib/auth'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  status: string
}

/**
 * GET /api/auth/session
 * Uses the httpOnly refreshToken cookie to return the current user + fresh accessToken.
 * Called by the blog app to check if a user is logged in.
 */
export async function GET(request: NextRequest) {
  const corsOrigin = request.headers.get('origin') ?? '*'
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  const refreshToken = request.cookies.get('refreshToken')?.value
  if (!refreshToken) {
    return NextResponse.json({ user: null }, { headers: corsHeaders })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return NextResponse.json({ user: null }, { headers: corsHeaders })
  }

  try {
    const payload = jwt.verify(refreshToken, secret) as { sub: string; email: string; role: string; type?: string }
    if (payload.type !== 'refresh') {
      return NextResponse.json({ user: null }, { headers: corsHeaders })
    }

    const db = getDb()
    const user = db.prepare(
      'SELECT id, name, email, role, status FROM users WHERE id = ? AND status = ?'
    ).get(payload.sub, 'active') as UserRow | undefined

    if (!user) {
      return NextResponse.json({ user: null }, { headers: corsHeaders })
    }

    const tokenPayload = { sub: user.id, email: user.email, role: user.role }
    const accessToken = generateToken(tokenPayload)

    return NextResponse.json(
      { user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken },
      { headers: corsHeaders }
    )
  } catch {
    return NextResponse.json({ user: null }, { headers: corsHeaders })
  }
}

export async function OPTIONS(request: NextRequest) {
  const corsOrigin = request.headers.get('origin') ?? '*'
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

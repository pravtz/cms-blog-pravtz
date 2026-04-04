import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

export interface AuthPayload {
  sub: string
  email: string
  role: string
}

export function requireAuth(
  request: NextRequest
): { payload: AuthPayload } | NextResponse {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  try {
    const payload = jwt.verify(token, secret) as AuthPayload
    return { payload }
  } catch {
    return NextResponse.json({ error: 'Invalid or expired token.' }, { status: 401 })
  }
}

export function requireRole(
  request: NextRequest,
  ...roles: string[]
): { payload: AuthPayload } | NextResponse {
  const result = requireAuth(request)
  if (result instanceof NextResponse) return result

  if (!roles.includes(result.payload.role)) {
    return NextResponse.json({ error: 'Insufficient permissions.' }, { status: 403 })
  }

  return result
}

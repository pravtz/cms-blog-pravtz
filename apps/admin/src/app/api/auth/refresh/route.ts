import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { getDb } from '@/lib/db'
import { generateToken, generateRefreshToken } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface JwtPayload {
  sub: string
  email: string
  role: string
}

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  status: string
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('refreshToken')?.value
  if (!refreshToken) {
    return NextResponse.json({ error: 'No refresh token.' }, { status: 401 })
  }

  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let payload: JwtPayload
  try {
    payload = jwt.verify(refreshToken, secret) as JwtPayload
  } catch {
    return NextResponse.json({ error: 'Invalid or expired refresh token.' }, { status: 401 })
  }

  const db = getDb()
  const user = db
    .prepare('SELECT id, name, email, role, status FROM users WHERE id = ?')
    .get(payload.sub) as UserRow | undefined

  if (!user || user.status !== 'active') {
    return NextResponse.json({ error: 'User not found or not active.' }, { status: 401 })
  }

  const tokenPayload = { sub: user.id, email: user.email, role: user.role }
  const newAccessToken = generateToken(tokenPayload)
  const newRefreshToken = generateRefreshToken(tokenPayload)

  const response = NextResponse.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    accessToken: newAccessToken,
  })

  response.cookies.set('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return response
}

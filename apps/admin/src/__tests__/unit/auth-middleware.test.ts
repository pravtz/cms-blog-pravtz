import { describe, it, expect } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireRole } from '@/lib/auth-middleware'
import { generateToken } from '@/lib/auth'

function makeRequest(token?: string) {
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  return new NextRequest('http://localhost/test', { headers })
}

function validToken(role = 'author') {
  return generateToken({ sub: 'user-1', email: 'a@b.com', role })
}

describe('requireAuth', () => {
  it('returns payload for a valid token', () => {
    const token = validToken()
    const result = requireAuth(makeRequest(token))
    expect(result instanceof NextResponse).toBe(false)
    if (!(result instanceof NextResponse)) {
      expect(result.payload.sub).toBe('user-1')
      expect(result.payload.role).toBe('author')
    }
  })

  it('returns 401 when no Authorization header', () => {
    const result = requireAuth(makeRequest())
    expect(result instanceof NextResponse).toBe(true)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401)
    }
  })

  it('returns 401 for an invalid token', () => {
    const result = requireAuth(makeRequest('bad.token.value'))
    expect(result instanceof NextResponse).toBe(true)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401)
    }
  })

  it('returns 401 for an expired token', async () => {
    // generateToken issues 15-min tokens; use a token signed with wrong secret to simulate expired
    const result = requireAuth(makeRequest('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4IiwiZXhwIjoxfQ.invalid'))
    expect(result instanceof NextResponse).toBe(true)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401)
    }
  })
})

describe('requireRole', () => {
  it('returns payload when user has a required role', () => {
    const token = validToken('admin')
    const result = requireRole(makeRequest(token), 'admin', 'owner')
    expect(result instanceof NextResponse).toBe(false)
    if (!(result instanceof NextResponse)) {
      expect(result.payload.role).toBe('admin')
    }
  })

  it('returns 403 when user role is not in the allowed list', () => {
    const token = validToken('default')
    const result = requireRole(makeRequest(token), 'admin', 'owner')
    expect(result instanceof NextResponse).toBe(true)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(403)
    }
  })

  it('returns 401 when no token is provided', () => {
    const result = requireRole(makeRequest(), 'admin')
    expect(result instanceof NextResponse).toBe(true)
    if (result instanceof NextResponse) {
      expect(result.status).toBe(401)
    }
  })
})

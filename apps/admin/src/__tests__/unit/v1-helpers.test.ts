import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { getClientIp, buildV1Headers, handleOptions } from '@/lib/v1-helpers'

describe('getClientIp', () => {
  it('extracts first IP from x-forwarded-for', () => {
    const req = new NextRequest('http://localhost/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getClientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = new NextRequest('http://localhost/', {
      headers: { 'x-real-ip': '9.9.9.9' },
    })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('defaults to 127.0.0.1 when no IP header present', () => {
    const req = new NextRequest('http://localhost/')
    expect(getClientIp(req)).toBe('127.0.0.1')
  })
})

describe('buildV1Headers', () => {
  const rl = { limit: 60, remaining: 55, reset: 9999999 }

  it('includes security headers', () => {
    const h = buildV1Headers(rl)
    expect(h['X-Content-Type-Options']).toBe('nosniff')
    expect(h['X-Frame-Options']).toBe('DENY')
    expect(h['Strict-Transport-Security']).toContain('max-age=')
  })

  it('includes CORS headers', () => {
    const h = buildV1Headers(rl)
    expect(h['Access-Control-Allow-Origin']).toBe('*')
    expect(h['Access-Control-Allow-Methods']).toContain('GET')
  })

  it('includes rate-limit headers matching the input', () => {
    const h = buildV1Headers(rl)
    expect(h['X-RateLimit-Limit']).toBe('60')
    expect(h['X-RateLimit-Remaining']).toBe('55')
    expect(h['X-RateLimit-Reset']).toBe('9999999')
  })

  it('merges extra headers without overwriting rate-limit headers', () => {
    const h = buildV1Headers(rl, { 'X-Custom': 'value' })
    expect(h['X-Custom']).toBe('value')
    expect(h['X-RateLimit-Limit']).toBe('60')
  })
})

describe('handleOptions', () => {
  it('returns 204 with CORS headers', () => {
    const res = handleOptions()
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('GET')
    expect(res.headers.get('access-control-max-age')).toBe('86400')
  })
})

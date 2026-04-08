import { describe, it, expect } from 'vitest'
import jwt from 'jsonwebtoken'
import {
  hashPassword,
  verifyPassword,
  generateToken,
  generateRefreshToken,
  generateEmailToken,
  emailTokenExpiry,
} from '@/lib/auth'

describe('hashPassword', () => {
  it('returns a bcrypt hash (not the plaintext)', async () => {
    const hash = await hashPassword('mypassword')
    expect(hash).not.toBe('mypassword')
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it('different calls produce different hashes (salt)', async () => {
    const h1 = await hashPassword('same')
    const h2 = await hashPassword('same')
    expect(h1).not.toBe(h2)
  })
})

describe('verifyPassword', () => {
  it('returns true when password matches the hash', async () => {
    const hash = await hashPassword('correct-horse')
    expect(await verifyPassword('correct-horse', hash)).toBe(true)
  })

  it('returns false when password does not match', async () => {
    const hash = await hashPassword('correct-horse')
    expect(await verifyPassword('wrong-horse', hash)).toBe(false)
  })
})

describe('generateToken', () => {
  it('creates a verifiable JWT with the given payload', () => {
    const payload = { sub: 'user-1', email: 'a@b.com', role: 'owner' }
    const token = generateToken(payload)
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>
    expect(decoded.sub).toBe('user-1')
    expect(decoded.email).toBe('a@b.com')
    expect(decoded.role).toBe('owner')
  })

  it('throws when JWT_SECRET is missing', () => {
    const orig = process.env.JWT_SECRET
    delete process.env.JWT_SECRET
    expect(() => generateToken({ sub: '1' })).toThrow('JWT_SECRET is not set')
    process.env.JWT_SECRET = orig
  })

  it('sets a 15-minute expiry', () => {
    const before = Math.floor(Date.now() / 1000)
    const token = generateToken({ sub: 'u1' })
    const decoded = jwt.decode(token) as { exp: number; iat: number }
    const diff = decoded.exp - decoded.iat
    expect(diff).toBeCloseTo(15 * 60, -1)
    expect(decoded.exp).toBeGreaterThan(before)
  })
})

describe('generateRefreshToken', () => {
  it('creates a verifiable JWT signed with the refresh secret', () => {
    const payload = { sub: 'user-2', email: 'b@c.com', role: 'default' }
    const token = generateRefreshToken(payload)
    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET!
    ) as Record<string, unknown>
    expect(decoded.sub).toBe('user-2')
  })

  it('throws when JWT_REFRESH_SECRET is missing', () => {
    const orig = process.env.JWT_REFRESH_SECRET
    delete process.env.JWT_REFRESH_SECRET
    expect(() => generateRefreshToken({ sub: '1' })).toThrow('JWT_REFRESH_SECRET is not set')
    process.env.JWT_REFRESH_SECRET = orig
  })

  it('sets a 7-day expiry', () => {
    const token = generateRefreshToken({ sub: 'u2' })
    const decoded = jwt.decode(token) as { exp: number; iat: number }
    const diff = decoded.exp - decoded.iat
    expect(diff).toBeCloseTo(7 * 24 * 60 * 60, -1)
  })
})

describe('generateEmailToken', () => {
  it('returns a UUID string', () => {
    const token = generateEmailToken()
    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('generates unique tokens on each call', () => {
    expect(generateEmailToken()).not.toBe(generateEmailToken())
  })
})

describe('emailTokenExpiry', () => {
  it('returns an ISO string roughly 24 hours in the future', () => {
    const expiry = emailTokenExpiry()
    const diff = new Date(expiry).getTime() - Date.now()
    // Should be 24h ± 5 seconds
    expect(diff).toBeGreaterThan(24 * 60 * 60 * 1000 - 5000)
    expect(diff).toBeLessThan(24 * 60 * 60 * 1000 + 5000)
  })
})

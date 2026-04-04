import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

const BCRYPT_ROUNDS = 12
const ACCESS_TOKEN_EXPIRY = '15m'
const REFRESH_TOKEN_EXPIRY = '7d'

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(payload: Record<string, unknown>): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRY })
}

export function generateRefreshToken(payload: Record<string, unknown>): string {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not set')
  return jwt.sign(payload, secret, { expiresIn: REFRESH_TOKEN_EXPIRY })
}

export function generateEmailToken(): string {
  return randomUUID()
}

export function emailTokenExpiry(): string {
  const expires = new Date()
  expires.setHours(expires.getHours() + 24)
  return expires.toISOString()
}

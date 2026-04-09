/**
 * Test-only endpoint: returns the email_token for a user (for E2E email flow testing).
 * Only available when E2E_TESTING=true environment variable is set.
 * NEVER expose this in production.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (process.env.E2E_TESTING !== 'true') {
    return NextResponse.json({ error: 'Not available.' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')

  if (!email) {
    return NextResponse.json({ error: 'email query param is required.' }, { status: 400 })
  }

  const db = getDb()
  const user = db
    .prepare('SELECT email_token, status FROM users WHERE email = ?')
    .get(email) as { email_token: string | null; status: string } | undefined

  if (!user) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 })
  }

  return NextResponse.json({ email_token: user.email_token, status: user.status })
}

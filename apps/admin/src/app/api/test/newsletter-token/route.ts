/**
 * Test-only endpoint: returns the newsletter confirmation token for an email.
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
  const subscriber = db
    .prepare('SELECT token, status FROM newsletter_subscribers WHERE email = ?')
    .get(email) as { token: string | null; status: string } | undefined

  if (!subscriber) {
    return NextResponse.json({ error: 'Subscriber not found.' }, { status: 404 })
  }

  return NextResponse.json({ token: subscriber.token, status: subscriber.status })
}

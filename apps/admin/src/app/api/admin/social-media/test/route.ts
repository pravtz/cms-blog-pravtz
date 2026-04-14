export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import { getSocialMediaSettings } from '@/lib/social-media'
import { testTwitterConnection, testLinkedInConnection, testFacebookConnection } from '@/lib/social-media'
import { z } from 'zod'

const TestSchema = z.object({
  network: z.enum(['twitter', 'linkedin', 'facebook']),
})

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const parsed = TestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const settings = getSocialMediaSettings()
  const { network } = parsed.data

  let result: { ok: boolean; message: string }

  if (network === 'twitter') {
    result = await testTwitterConnection(settings.twitter)
  } else if (network === 'linkedin') {
    result = await testLinkedInConnection(settings.linkedin)
  } else {
    result = await testFacebookConnection(settings.facebook)
  }

  if (result.ok) {
    return NextResponse.json({ message: result.message })
  }
  return NextResponse.json({ error: result.message }, { status: 422 })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth-middleware'
import { getSetting, setSetting } from '@/lib/db'
import { getSocialMediaSettings } from '@/lib/social-media'
import { z } from 'zod'

const NetworkBaseSchema = z.object({
  profileUrl: z.string().optional().default(''),
  autoShare: z.boolean().optional().default(false),
})

const SocialMediaSchema = z.object({
  github: NetworkBaseSchema.optional().default({}),
  instagram: NetworkBaseSchema.optional().default({}),
  linkedin: NetworkBaseSchema.extend({
    accessToken: z.string().optional().default(''),
    personUrn: z.string().optional().default(''),
  }).optional().default({}),
  facebook: NetworkBaseSchema.extend({
    pageId: z.string().optional().default(''),
    pageAccessToken: z.string().optional().default(''),
  }).optional().default({}),
  twitter: NetworkBaseSchema.extend({
    apiKey: z.string().optional().default(''),
    apiSecret: z.string().optional().default(''),
    accessToken: z.string().optional().default(''),
    accessTokenSecret: z.string().optional().default(''),
  }).optional().default({}),
})

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const settings = getSocialMediaSettings()

  // Mask sensitive credentials in response
  const masked = {
    ...settings,
    linkedin: {
      ...settings.linkedin,
      accessToken: settings.linkedin.accessToken ? '••••••••' : '',
    },
    facebook: {
      ...settings.facebook,
      pageAccessToken: settings.facebook.pageAccessToken ? '••••••••' : '',
    },
    twitter: {
      ...settings.twitter,
      apiSecret: settings.twitter.apiSecret ? '••••••••' : '',
      accessTokenSecret: settings.twitter.accessTokenSecret ? '••••••••' : '',
    },
  }

  return NextResponse.json({ settings: masked })
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'owner')
  if (auth instanceof NextResponse) return auth

  const body = await request.json()
  const parsed = SocialMediaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  // Merge with existing (preserve masked/unchanged secrets)
  const existing = getSocialMediaSettings()
  const incoming = parsed.data

  function mergeSecret(incoming: string | undefined, existing: string | undefined): string {
    if (!incoming || incoming === '••••••••') return existing ?? ''
    return incoming
  }

  const merged = {
    github: { ...existing.github, ...incoming.github },
    instagram: { ...existing.instagram, ...incoming.instagram },
    linkedin: {
      ...existing.linkedin,
      ...incoming.linkedin,
      accessToken: mergeSecret(incoming.linkedin?.accessToken, existing.linkedin.accessToken),
    },
    facebook: {
      ...existing.facebook,
      ...incoming.facebook,
      pageAccessToken: mergeSecret(incoming.facebook?.pageAccessToken, existing.facebook.pageAccessToken),
    },
    twitter: {
      ...existing.twitter,
      ...incoming.twitter,
      apiSecret: mergeSecret(incoming.twitter?.apiSecret, existing.twitter.apiSecret),
      accessTokenSecret: mergeSecret(incoming.twitter?.accessTokenSecret, existing.twitter.accessTokenSecret),
    },
  }

  setSetting('social_media_config', JSON.stringify(merged))

  return NextResponse.json({ ok: true })
}

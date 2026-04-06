export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getDb, getSetting } from '@/lib/db'

export async function GET() {
  const db = getDb()

  const owner = db
    .prepare("SELECT name, email FROM users WHERE role = 'owner' LIMIT 1")
    .get() as { name: string; email: string } | undefined

  if (!owner) {
    return NextResponse.json({ owner: null })
  }

  const profile = {
    name: owner.name,
    bio: getSetting('owner_bio') ?? '',
    avatar: getSetting('owner_avatar') ?? '',
    blogName: getSetting('blog_name') ?? '',
    blogDescription: getSetting('blog_description') ?? '',
    blogUrl: getSetting('blog_url') ?? '',
    socialGithub: getSetting('social_github') ?? '',
    socialLinkedin: getSetting('social_linkedin') ?? '',
    socialTwitter: getSetting('social_twitter') ?? '',
    socialInstagram: getSetting('social_instagram') ?? '',
  }

  return NextResponse.json(
    { owner: profile },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

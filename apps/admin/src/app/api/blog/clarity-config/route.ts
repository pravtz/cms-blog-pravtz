export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getSetting } from '@/lib/db'

export async function GET() {
  const enabled = getSetting('clarity_enabled') === 'true'
  const projectId = getSetting('clarity_project_id') ?? ''

  return NextResponse.json(
    { enabled, projectId },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}

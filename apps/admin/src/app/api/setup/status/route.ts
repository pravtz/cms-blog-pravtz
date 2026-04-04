import { NextResponse } from 'next/server'
import { ownerExists } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const setupComplete = ownerExists()
    return NextResponse.json({ setupComplete })
  } catch {
    return NextResponse.json({ setupComplete: false })
  }
}

import { NextResponse } from 'next/server'

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001'

export async function GET() {
  try {
    const res = await fetch(`${ADMIN_URL}/api/blog/categories`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return NextResponse.json({ categories: [] }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch {
    return NextResponse.json({ categories: [] }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') ?? '1'
  const limit = searchParams.get('limit') ?? '12'

  try {
    const res = await fetch(
      `${ADMIN_URL}/api/blog/posts?page=${page}&limit=${limit}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) {
      return NextResponse.json({ posts: [], total: 0 }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    })
  } catch {
    return NextResponse.json({ posts: [], total: 0 }, { status: 500 })
  }
}

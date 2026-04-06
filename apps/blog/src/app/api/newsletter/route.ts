import { NextRequest, NextResponse } from 'next/server'

const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.email) {
    return NextResponse.json({ error: 'Email obrigatório' }, { status: 400 })
  }

  try {
    const res = await fetch(`${ADMIN_URL}/api/blog/newsletter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email }),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.ok ? 200 : res.status })
  } catch {
    return NextResponse.json({ error: 'Erro ao processar inscrição' }, { status: 500 })
  }
}

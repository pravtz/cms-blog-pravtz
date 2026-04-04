import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireRole } from '@/lib/auth-middleware'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface UserRow {
  id: string
  name: string
  email: string
  role: string
  status: string
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'owner', 'admin')
  if (auth instanceof NextResponse) return auth

  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')

  const db = getDb()

  const query = statusFilter
    ? "SELECT id, name, email, role, status, created_at, updated_at FROM users WHERE status = ? ORDER BY created_at DESC"
    : "SELECT id, name, email, role, status, created_at, updated_at FROM users ORDER BY created_at DESC"

  const users = statusFilter
    ? db.prepare(query).all(statusFilter) as UserRow[]
    : db.prepare(query).all() as UserRow[]

  return NextResponse.json({ users })
}

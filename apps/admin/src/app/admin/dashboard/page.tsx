import { redirect } from 'next/navigation'
import { ownerExists } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  if (!ownerExists()) {
    redirect('/admin/setup')
  }

  return (
    <main style={{ padding: '40px', color: '#f0f0f0', fontFamily: 'Inter, sans-serif' }}>
      <h1>Dashboard</h1>
      <p>Welcome to Nexus CMS. Dashboard will be implemented in US-17.</p>
    </main>
  )
}

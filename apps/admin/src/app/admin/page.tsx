import { redirect } from 'next/navigation'
import { ownerExists } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default function AdminRootPage() {
  const setupDone = ownerExists()
  if (!setupDone) {
    redirect('/admin/setup')
  }
  redirect('/admin/dashboard')
}

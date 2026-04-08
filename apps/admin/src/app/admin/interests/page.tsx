import { redirect } from 'next/navigation'
import { ownerExists } from '@/lib/db'
import InterestsForm from './interests-form'

export const dynamic = 'force-dynamic'

export default function InterestsPage() {
  if (!ownerExists()) {
    redirect('/admin/setup')
  }

  return (
    <main>
      <InterestsForm />
    </main>
  )
}

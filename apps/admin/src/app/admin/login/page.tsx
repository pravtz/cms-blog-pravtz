import { redirect } from 'next/navigation'
import { ownerExists } from '@/lib/db'
import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { setup?: string }
}) {
  if (!ownerExists()) {
    redirect('/admin/setup')
  }

  return (
    <main>
      <LoginForm setupComplete={searchParams.setup === 'complete'} />
    </main>
  )
}

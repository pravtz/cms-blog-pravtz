import { redirect } from 'next/navigation'
import { ownerExists } from '@/lib/db'
import RegisterForm from './register-form'

export const dynamic = 'force-dynamic'

export default function RegisterPage() {
  if (!ownerExists()) {
    redirect('/admin/setup')
  }

  return (
    <main>
      <RegisterForm />
    </main>
  )
}

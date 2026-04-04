import ConfirmEmailClient from './confirm-email-client'

export const dynamic = 'force-dynamic'

export default function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const token = searchParams.token ?? null
  return (
    <main>
      <ConfirmEmailClient token={token} />
    </main>
  )
}

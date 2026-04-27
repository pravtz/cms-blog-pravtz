'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import styles from '../confirm/page.module.css'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'

function UnsubscribeContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Token de cancelamento não encontrado.')
      return
    }

    fetch(`${ADMIN_URL}/api/blog/newsletter/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (res.ok && data.ok) {
          setStatus('success')
          setMessage(data.message || 'Desinscrito com sucesso.')
        } else {
          setStatus('error')
          setMessage(data.error || 'Não foi possível processar o cancelamento.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Erro ao processar cancelamento. Tente novamente mais tarde.')
      })
  }, [token])

  return (
    <div className={styles.card}>
      {status === 'loading' && (
        <>
          <div className={styles.spinner} role="status" aria-label="Carregando…" />
          <p className={styles.text}>Processando cancelamento…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className={styles.icon} aria-hidden="true">✓</div>
          <h1 className={styles.title}>Cancelamento confirmado</h1>
          <p className={styles.text}>{message}</p>
          <p className={styles.text}>
            Você não receberá mais e-mails da nossa newsletter. Se mudar de ideia, pode
            se inscrever novamente a qualquer momento.
          </p>
          <Link href="/" className={styles.button}>
            Voltar ao início
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div className={styles.iconError} aria-hidden="true">✕</div>
          <h1 className={styles.title}>Ops!</h1>
          <p className={styles.text}>{message}</p>
          <Link href="/" className={styles.button}>
            Voltar ao início
          </Link>
        </>
      )}
    </div>
  )
}

export default function NewsletterUnsubscribePage() {
  return (
    <main className={styles.main}>
      <Suspense fallback={
        <div className={styles.card}>
          <div className={styles.spinner} role="status" aria-label="Carregando…" />
        </div>
      }>
        <UnsubscribeContent />
      </Suspense>
    </main>
  )
}

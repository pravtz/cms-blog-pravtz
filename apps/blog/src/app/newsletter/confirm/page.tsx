'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'

function ConfirmContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Token de confirmação não encontrado.')
      return
    }

    fetch(`${ADMIN_URL}/api/blog/newsletter/confirm?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json()
        if (res.ok && data.ok) {
          setStatus('success')
          setMessage(data.message || 'Inscrição confirmada com sucesso!')
        } else {
          setStatus('error')
          setMessage(data.error || 'Não foi possível confirmar sua inscrição.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Erro ao confirmar inscrição. Tente novamente mais tarde.')
      })
  }, [token])

  return (
    <div className={styles.card}>
      {status === 'loading' && (
        <>
          <div className={styles.spinner} role="status" aria-label="Carregando…" />
          <p className={styles.text}>Confirmando sua inscrição…</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className={styles.icon} aria-hidden="true">✓</div>
          <h1 className={styles.title}>Inscrição confirmada!</h1>
          <p className={styles.text}>{message}</p>
          <Link href="/blog" className={styles.button}>
            Explorar artigos
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

export default function NewsletterConfirmPage() {
  return (
    <main className={styles.main}>
      <Suspense fallback={
        <div className={styles.card}>
          <div className={styles.spinner} role="status" aria-label="Carregando…" />
        </div>
      }>
        <ConfirmContent />
      </Suspense>
    </main>
  )
}

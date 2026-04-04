'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './confirm-email.module.css'

type State = 'loading' | 'success' | 'error' | 'no-token'

export default function ConfirmEmailClient({ token }: { token: string | null }) {
  const [state, setState] = useState<State>(token ? 'loading' : 'no-token')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return

    async function confirm() {
      try {
        const res = await fetch('/api/auth/confirm-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const json = await res.json()
        if (res.ok) {
          setState('success')
          setMessage(json.message ?? 'Email confirmed successfully.')
        } else {
          setState('error')
          setMessage(json.error ?? 'Confirmation failed.')
        }
      } catch {
        setState('error')
        setMessage('Network error. Please try again.')
      }
    }

    confirm()
  }, [token])

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>Nexus CMS</div>
          <h1 className={styles.title}>Email Confirmation</h1>
        </div>

        {state === 'loading' && (
          <p className={styles.message}>Confirming your email…</p>
        )}

        {state === 'success' && (
          <>
            <div className={styles.successBanner} role="status">
              {message}
            </div>
            <p className={styles.footer}>
              <Link href="/admin/login" className={styles.link}>Sign in</Link>
            </p>
          </>
        )}

        {(state === 'error' || state === 'no-token') && (
          <>
            <p className={styles.error} role="alert">
              {state === 'no-token'
                ? 'No confirmation token provided.'
                : message}
            </p>
            <p className={styles.footer}>
              <Link href="/admin/login" className={styles.link}>Back to sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

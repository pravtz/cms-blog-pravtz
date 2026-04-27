'use client'

import { useState, FormEvent } from 'react'
import styles from './NewsletterCard.module.css'

export default function NewsletterCard() {
  const [email, setEmail] = useState('')
  const [privacy, setPrivacy] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!privacy) return

    setStatus('loading')
    setErrorMessage('')

    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        setStatus('success')
      } else {
        setStatus('error')
        setErrorMessage(data.error ?? 'Erro ao realizar inscrição. Tente novamente.')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Erro ao realizar inscrição. Tente novamente.')
    }
  }

  if (status === 'success') {
    return (
      <div className={styles.card} role="status" aria-live="polite">
        <div className={styles.successIcon} aria-hidden="true">✓</div>
        <h3 className={styles.successTitle}>Verifique seu e-mail!</h3>
        <p className={styles.successText}>
          Enviamos um link de confirmação para <strong>{email}</strong>.
          Clique no link para confirmar sua inscrição.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.icon} aria-hidden="true">✉</div>
      <h3 className={styles.title}>Receba novos artigos</h3>
      <p className={styles.description}>
        Inscreva-se na newsletter e receba os melhores artigos diretamente no seu e-mail.
        Sem spam, cancele quando quiser.
      </p>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.inputRow}>
          <label htmlFor="newsletter-email" className="sr-only">
            Seu e-mail
          </label>
          <input
            id="newsletter-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
            className={styles.input}
            disabled={status === 'loading'}
            aria-describedby={status === 'error' ? 'newsletter-error' : undefined}
          />
          <button
            type="submit"
            className={styles.button}
            disabled={status === 'loading' || !privacy || !email}
          >
            {status === 'loading' ? 'Enviando…' : 'Inscrever-se'}
          </button>
        </div>

        <label className={styles.privacyLabel}>
          <input
            id="newsletter-privacy"
            type="checkbox"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            className={styles.checkbox}
            required
            aria-label="Li e aceito a política de privacidade"
          />
          <span>
            Li e aceito a{' '}
            <a href="/privacidade" className={styles.privacyLink} target="_blank" rel="noopener noreferrer">
              política de privacidade
            </a>
          </span>
        </label>

        {status === 'error' && (
          <p id="newsletter-error" className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}
      </form>
    </div>
  )
}

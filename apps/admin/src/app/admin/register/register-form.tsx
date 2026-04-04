'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import styles from './register.module.css'

type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong'

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return 'weak'
  if (score === 2) return 'fair'
  if (score === 3) return 'strong'
  return 'very-strong'
}

const strengthConfig: Record<PasswordStrength, { label: string; color: string; width: string }> = {
  weak: { label: 'Weak', color: '#f87171', width: '25%' },
  fair: { label: 'Fair', color: '#fb923c', width: '50%' },
  strong: { label: 'Strong', color: '#facc15', width: '75%' },
  'very-strong': { label: 'Very strong', color: '#4ade80', width: '100%' },
}

export default function RegisterForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const strength = password ? getPasswordStrength(password) : null
  const strengthInfo = strength ? strengthConfig[strength] : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      if (res.ok || res.status === 201 || res.status === 200) {
        setSuccess(true)
      } else {
        const json = await res.json()
        setError(json.error ?? 'Registration failed. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <div className={styles.logo}>Nexus CMS</div>
            <h1 className={styles.title}>Check your email</h1>
          </div>
          <div className={styles.successBanner} role="status">
            We sent a confirmation link to <strong>{email}</strong>. Please click it to activate your account.
          </div>
          <p className={styles.footer}>
            Didn&apos;t receive it?{' '}
            <ResendLink email={email} />
          </p>
          <p className={styles.footer}>
            <Link href="/admin/login" className={styles.link}>Back to sign in</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>Nexus CMS</div>
          <h1 className={styles.title}>Create account</h1>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
              autoComplete="name"
              required
              minLength={2}
              maxLength={100}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              autoComplete="email"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              autoComplete="new-password"
              required
              minLength={8}
            />
            {strengthInfo && (
              <>
                <div
                  className={styles.strengthBar}
                  style={{ background: strengthInfo.color, width: strengthInfo.width }}
                  role="meter"
                  aria-label="Password strength"
                  aria-valuenow={['weak','fair','strong','very-strong'].indexOf(strength!) + 1}
                  aria-valuemin={1}
                  aria-valuemax={4}
                />
                <p className={styles.strengthLabel} style={{ color: strengthInfo.color }}>
                  {strengthInfo.label}
                </p>
              </>
            )}
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={loading}
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className={styles.footer}>
          Already have an account?{' '}
          <Link href="/admin/login" className={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

function ResendLink({ email }: { email: string }) {
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function resend() {
    setLoading(true)
    try {
      await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  if (sent) return <span style={{ color: '#4ade80' }}>Sent!</span>

  return (
    <button
      onClick={resend}
      disabled={loading}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      className={`${styles.link}`}
    >
      {loading ? 'Sending…' : 'Resend email'}
    </button>
  )
}

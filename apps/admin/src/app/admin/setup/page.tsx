'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import styles from './setup.module.css'

type Step = 1 | 2 | 3 | 4

interface SetupData {
  // Step 1: Owner
  ownerName: string
  ownerEmail: string
  ownerPassword: string
  ownerPasswordConfirm: string
  // Step 2: DB
  dbType: 'sqlite'
  // Step 3: SMTP
  smtpHost: string
  smtpPort: string
  smtpUser: string
  smtpPass: string
  smtpFrom: string
  // Step 4: Blog identity
  blogName: string
  blogDescription: string
  blogUrl: string
}

const INITIAL_DATA: SetupData = {
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
  ownerPasswordConfirm: '',
  dbType: 'sqlite',
  smtpHost: '',
  smtpPort: '587',
  smtpUser: '',
  smtpPass: '',
  smtpFrom: '',
  blogName: '',
  blogDescription: '',
  blogUrl: '',
}

const STEP_TITLES: Record<Step, string> = {
  1: 'Owner Account',
  2: 'Database',
  3: 'Email (SMTP)',
  4: 'Blog Identity',
}

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [data, setData] = useState<SetupData>(INITIAL_DATA)
  const [errors, setErrors] = useState<Partial<Record<keyof SetupData, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState('')

  useEffect(() => {
    // If setup already done, redirect to admin login
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then(({ setupComplete }) => {
        if (setupComplete) {
          router.replace('/admin/login')
        }
      })
      .catch(() => {})
  }, [router])

  function update(field: keyof SetupData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validateStep(): boolean {
    const errs: Partial<Record<keyof SetupData, string>> = {}

    if (step === 1) {
      if (!data.ownerName.trim() || data.ownerName.length < 2)
        errs.ownerName = 'Name must be at least 2 characters.'
      if (!data.ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.ownerEmail))
        errs.ownerEmail = 'Enter a valid email address.'
      if (!data.ownerPassword || data.ownerPassword.length < 8)
        errs.ownerPassword = 'Password must be at least 8 characters.'
      if (data.ownerPassword !== data.ownerPasswordConfirm)
        errs.ownerPasswordConfirm = 'Passwords do not match.'
    }

    if (step === 3) {
      // SMTP is optional, but if host is provided, validate related fields
      if (data.smtpHost) {
        const port = parseInt(data.smtpPort, 10)
        if (!data.smtpPort || isNaN(port) || port < 1 || port > 65535)
          errs.smtpPort = 'Enter a valid port (1–65535).'
        if (data.smtpFrom && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.smtpFrom))
          errs.smtpFrom = 'Enter a valid from email address.'
      }
    }

    if (step === 4) {
      if (!data.blogName.trim())
        errs.blogName = 'Blog name is required.'
      if (!data.blogUrl.trim() || !/^https?:\/\/.+/.test(data.blogUrl))
        errs.blogUrl = 'Enter a valid URL (e.g. https://myblog.com).'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextStep() {
    if (!validateStep()) return
    if (step < 4) setStep((prev) => (prev + 1) as Step)
  }

  function prevStep() {
    if (step > 1) setStep((prev) => (prev - 1) as Step)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validateStep()) return
    setSubmitting(true)
    setGlobalError('')

    try {
      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerName: data.ownerName,
          ownerEmail: data.ownerEmail,
          ownerPassword: data.ownerPassword,
          dbType: data.dbType,
          smtpHost: data.smtpHost || undefined,
          smtpPort: data.smtpPort ? parseInt(data.smtpPort, 10) : undefined,
          smtpUser: data.smtpUser || undefined,
          smtpPass: data.smtpPass || undefined,
          smtpFrom: data.smtpFrom || undefined,
          blogName: data.blogName,
          blogDescription: data.blogDescription || undefined,
          blogUrl: data.blogUrl,
        }),
      })

      if (res.ok) {
        router.push('/admin/login?setup=complete')
      } else {
        const json = await res.json()
        setGlobalError(json.error ?? 'Setup failed. Please try again.')
      }
    } catch {
      setGlobalError('Network error. Please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>Nexus CMS</div>
          <h1 className={styles.title}>First Run Setup</h1>
          <p className={styles.subtitle}>
            Step {step} of 4 — {STEP_TITLES[step]}
          </p>
        </div>

        <div className={styles.progress}>
          {([1, 2, 3, 4] as Step[]).map((s) => (
            <div
              key={s}
              className={`${styles.progressStep} ${
                s < step ? styles.done : s === step ? styles.active : ''
              }`}
            >
              <div className={styles.progressDot}>{s < step ? '✓' : s}</div>
              <span className={styles.progressLabel}>{STEP_TITLES[s]}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {step === 1 && (
            <StepOwner data={data} errors={errors} update={update} />
          )}
          {step === 2 && (
            <StepDatabase data={data} errors={errors} update={update} />
          )}
          {step === 3 && (
            <StepSMTP data={data} errors={errors} update={update} />
          )}
          {step === 4 && (
            <StepBlogIdentity data={data} errors={errors} update={update} />
          )}

          {globalError && (
            <div className={styles.globalError} role="alert">
              {globalError}
            </div>
          )}

          <div className={styles.actions}>
            {step > 1 && (
              <button
                type="button"
                onClick={prevStep}
                className={styles.btnSecondary}
                disabled={submitting}
              >
                Back
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className={styles.btnPrimary}
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                className={styles.btnPrimary}
                disabled={submitting}
              >
                {submitting ? 'Setting up…' : 'Complete Setup'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StepProps {
  data: SetupData
  errors: Partial<Record<keyof SetupData, string>>
  update: (field: keyof SetupData, value: string) => void
}

function FieldGroup({
  label,
  error,
  children,
  hint,
}: {
  label: string
  error?: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
      {hint && !error && <p className={styles.hint}>{hint}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className={styles.input}
    />
  )
}

function StepOwner({ data, errors, update }: StepProps) {
  return (
    <div className={styles.stepContent}>
      <p className={styles.stepDescription}>
        The Owner has full access to Nexus CMS and cannot be removed. You can
        invite other users after setup.
      </p>
      <FieldGroup label="Full name" error={errors.ownerName}>
        <Input
          value={data.ownerName}
          onChange={(v) => update('ownerName', v)}
          placeholder="Jane Doe"
          autoComplete="name"
        />
      </FieldGroup>
      <FieldGroup label="Email address" error={errors.ownerEmail}>
        <Input
          type="email"
          value={data.ownerEmail}
          onChange={(v) => update('ownerEmail', v)}
          placeholder="jane@example.com"
          autoComplete="email"
        />
      </FieldGroup>
      <FieldGroup label="Password" error={errors.ownerPassword} hint="Minimum 8 characters.">
        <Input
          type="password"
          value={data.ownerPassword}
          onChange={(v) => update('ownerPassword', v)}
          autoComplete="new-password"
        />
      </FieldGroup>
      <FieldGroup label="Confirm password" error={errors.ownerPasswordConfirm}>
        <Input
          type="password"
          value={data.ownerPasswordConfirm}
          onChange={(v) => update('ownerPasswordConfirm', v)}
          autoComplete="new-password"
        />
      </FieldGroup>
    </div>
  )
}

function StepDatabase({ data: _data, errors: _errors, update: _update }: StepProps) {
  return (
    <div className={styles.stepContent}>
      <p className={styles.stepDescription}>
        Nexus CMS uses SQLite for the initial release. PostgreSQL support is
        planned for future versions.
      </p>
      <div className={styles.dbOption}>
        <div className={styles.dbOptionSelected}>
          <span className={styles.dbIcon}>🗃️</span>
          <div>
            <strong>SQLite</strong>
            <p>Zero-configuration embedded database. Perfect for self-hosted deployments.</p>
          </div>
          <span className={styles.badge}>Selected</span>
        </div>
      </div>
    </div>
  )
}

function StepSMTP({ data, errors, update }: StepProps) {
  return (
    <div className={styles.stepContent}>
      <p className={styles.stepDescription}>
        SMTP is optional but required for email confirmation, password reset,
        and notifications. You can configure this later in Settings.
      </p>
      <FieldGroup label="SMTP host" error={errors.smtpHost} hint="e.g. smtp.gmail.com">
        <Input
          value={data.smtpHost}
          onChange={(v) => update('smtpHost', v)}
          placeholder="smtp.example.com"
          autoComplete="off"
        />
      </FieldGroup>
      <FieldGroup label="SMTP port" error={errors.smtpPort}>
        <Input
          type="number"
          value={data.smtpPort}
          onChange={(v) => update('smtpPort', v)}
          placeholder="587"
        />
      </FieldGroup>
      <FieldGroup label="SMTP username" error={errors.smtpUser}>
        <Input
          value={data.smtpUser}
          onChange={(v) => update('smtpUser', v)}
          placeholder="user@example.com"
          autoComplete="username"
        />
      </FieldGroup>
      <FieldGroup label="SMTP password" error={errors.smtpPass}>
        <Input
          type="password"
          value={data.smtpPass}
          onChange={(v) => update('smtpPass', v)}
          autoComplete="new-password"
        />
      </FieldGroup>
      <FieldGroup label="From address" error={errors.smtpFrom} hint="Address shown in sent emails.">
        <Input
          type="email"
          value={data.smtpFrom}
          onChange={(v) => update('smtpFrom', v)}
          placeholder="noreply@example.com"
        />
      </FieldGroup>
    </div>
  )
}

function StepBlogIdentity({ data, errors, update }: StepProps) {
  return (
    <div className={styles.stepContent}>
      <p className={styles.stepDescription}>
        These details appear on your blog and are used for SEO metadata.
      </p>
      <FieldGroup label="Blog name" error={errors.blogName}>
        <Input
          value={data.blogName}
          onChange={(v) => update('blogName', v)}
          placeholder="My Awesome Blog"
        />
      </FieldGroup>
      <FieldGroup label="Description" error={errors.blogDescription} hint="Short description for SEO meta tags.">
        <textarea
          value={data.blogDescription}
          onChange={(e) => update('blogDescription', e.target.value)}
          placeholder="A blog about things I love."
          className={styles.textarea}
          rows={3}
          maxLength={500}
        />
      </FieldGroup>
      <FieldGroup label="Blog URL" error={errors.blogUrl} hint="The public URL of your blog.">
        <Input
          value={data.blogUrl}
          onChange={(v) => update('blogUrl', v)}
          placeholder="https://myblog.com"
          type="url"
        />
      </FieldGroup>
    </div>
  )
}

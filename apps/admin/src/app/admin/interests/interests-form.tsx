'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import styles from './interests.module.css'

interface Category {
  id: string
  name: string
  slug: string
}

const DEFAULT_INTERESTS: Category[] = [
  { id: 'tech', name: 'Technology', slug: 'technology' },
  { id: 'science', name: 'Science', slug: 'science' },
  { id: 'culture', name: 'Culture', slug: 'culture' },
  { id: 'business', name: 'Business', slug: 'business' },
  { id: 'health', name: 'Health', slug: 'health' },
  { id: 'politics', name: 'Politics', slug: 'politics' },
  { id: 'sports', name: 'Sports', slug: 'sports' },
  { id: 'entertainment', name: 'Entertainment', slug: 'entertainment' },
]

export default function InterestsForm() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auth/interests')
        if (res.status === 401) {
          router.push('/admin/login')
          return
        }
        if (res.ok) {
          const data = await res.json() as { categories: Category[]; selectedIds: string[] }
          // Use real categories if available, fall back to defaults
          setCategories(data.categories.length > 0 ? data.categories : DEFAULT_INTERESTS)
          setSelected(new Set(data.selectedIds))
        }
      } catch {
        setCategories(DEFAULT_INTERESTS)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (selected.size === 0) {
      setError('Please select at least one category.')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/auth/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryIds: Array.from(selected) }),
      })

      if (res.ok) {
        router.push('/admin/dashboard')
      } else {
        const json = await res.json()
        setError(json.error ?? 'Failed to save interests. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleSkip() {
    router.push('/admin/dashboard')
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.skeleton} aria-label="Loading…" />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logo}>Nexus CMS</div>
          <h1 className={styles.title}>Welcome! What interests you?</h1>
          <p className={styles.subtitle}>
            Select at least one category to personalise your experience.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className={styles.grid} role="group" aria-label="Category interests">
            {categories.map((cat) => {
              const isSelected = selected.has(cat.id)
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`${styles.chip} ${isSelected ? styles.chipSelected : ''}`}
                  onClick={() => toggle(cat.id)}
                  aria-pressed={isSelected}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={saving || selected.size === 0}
            >
              {saving ? 'Saving…' : `Continue (${selected.size} selected)`}
            </button>
            <button
              type="button"
              className={styles.btnSkip}
              onClick={handleSkip}
              disabled={saving}
            >
              Skip for now
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

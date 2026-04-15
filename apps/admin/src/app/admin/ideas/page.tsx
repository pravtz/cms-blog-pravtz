'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './page.module.css'
import { Badge, Modal } from '@/components'
import { useToast } from '@/components'

interface Idea {
  id: string
  title: string
  description: string | null
  rating: number
  created_by: string
  created_by_name: string
  shared_with: string
  created_at: string
  updated_at: string
}

interface User {
  id: string
  name: string
  email: string
}

function getRatingVariant(rating: number): 'error' | 'warning' | 'success' | 'info' {
  if (rating <= 3) return 'error'
  if (rating <= 6) return 'warning'
  return 'success'
}

function formatDate(iso: string) {
  try {
    return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const EMPTY_FORM = { title: '', description: '', rating: 5, shared_with: [] as string[] }

export default function IdeasPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [ideas, setIdeas] = useState<Idea[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const [minRating, setMinRating] = useState(0)
  const [sharedFilter, setSharedFilter] = useState<'all' | 'yes' | 'no'>('all')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [users, setUsers] = useState<User[]>([])

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchUsers = useCallback(async () => {
    const token = getToken()
    try {
      const res = await fetch('/api/admin/users?status=active&limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setUsers(data.users ?? [])
    } catch {
      // non-critical
    }
  }, [])

  const fetchIdeas = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (minRating > 0) params.set('min_rating', String(minRating))
    if (sharedFilter !== 'all') params.set('shared', sharedFilter)
    try {
      const res = await fetch(`/api/admin/ideas?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setIdeas(data.data)
      setTotal(data.meta.total)
      setTotalPages(data.meta.totalPages)
    } catch {
      toast({ variant: 'error', title: 'Failed to load ideas.' })
    } finally {
      setLoading(false)
    }
  }, [page, minRating, sharedFilter, toast])

  useEffect(() => {
    fetchIdeas()
    fetchUsers()
  }, [fetchIdeas, fetchUsers])

  function openCreate() {
    setEditingIdea(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(idea: Idea) {
    setEditingIdea(idea)
    setForm({
      title: idea.title,
      description: idea.description ?? '',
      rating: idea.rating,
      shared_with: JSON.parse(idea.shared_with),
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.title.trim()) {
      toast({ variant: 'error', title: 'Title is required.' })
      return
    }
    setSaving(true)
    const token = getToken()
    try {
      const url = editingIdea ? `/api/admin/ideas/${editingIdea.id}` : '/api/admin/ideas'
      const method = editingIdea ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          rating: form.rating,
          shared_with: form.shared_with,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save')
      }
      toast({ variant: 'success', title: editingIdea ? 'Idea updated.' : 'Idea created.' })
      setModalOpen(false)
      fetchIdeas()
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Failed to save idea.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(idea: Idea) {
    if (!confirm(`Delete idea "${idea.title}"? This cannot be undone.`)) return
    const token = getToken()
    try {
      const res = await fetch(`/api/admin/ideas/${idea.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      toast({ variant: 'success', title: 'Idea deleted.' })
      fetchIdeas()
    } catch {
      toast({ variant: 'error', title: 'Failed to delete idea.' })
    }
  }

  function handleConvertToDraft(idea: Idea) {
    router.push(`/admin/posts/new?title=${encodeURIComponent(idea.title)}`)
  }

  function toggleSharedWith(userId: string) {
    setForm((f) => ({
      ...f,
      shared_with: f.shared_with.includes(userId)
        ? f.shared_with.filter((id) => id !== userId)
        : [...f.shared_with, userId],
    }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Ideas</h1>
          <p className={styles.subtitle}>{total} idea{total !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.createBtn} onClick={openCreate}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Idea
        </button>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="min-rating">Min Rating</label>
          <select
            id="min-rating"
            className={styles.filterSelect}
            value={minRating}
            onChange={(e) => { setMinRating(Number(e.target.value)); setPage(1) }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((v) => (
              <option key={v} value={v}>{v === 0 ? 'Any' : `≥ ${v}`}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel} htmlFor="shared-filter">Shared</label>
          <select
            id="shared-filter"
            className={styles.filterSelect}
            value={sharedFilter}
            onChange={(e) => { setSharedFilter(e.target.value as 'all' | 'yes' | 'no'); setPage(1) }}
          >
            <option value="all">All</option>
            <option value="yes">Shared</option>
            <option value="no">Not shared</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className={styles.empty}>
          <p>No ideas found.</p>
          <button className={styles.emptyCreateBtn} onClick={openCreate}>
            Add your first idea
          </button>
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            {ideas.map((idea) => {
              let sharedWith: string[] = []
              try { sharedWith = JSON.parse(idea.shared_with) } catch { /* noop */ }
              return (
                <div key={idea.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{idea.title}</span>
                    <Badge variant={getRatingVariant(idea.rating)}>
                      {idea.rating}/10
                    </Badge>
                  </div>
                  {idea.description && (
                    <p className={styles.cardDescription}>{idea.description}</p>
                  )}
                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>By {idea.created_by_name}</span>
                    <span className={styles.metaItem}>{formatDate(idea.created_at)}</span>
                    {sharedWith.length > 0 && (
                      <span className={styles.sharedBadge}>
                        Shared with {sharedWith.length} user{sharedWith.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => openEdit(idea)}
                      aria-label={`Edit ${idea.title}`}
                    >
                      Edit
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.convertBtn}`}
                      onClick={() => handleConvertToDraft(idea)}
                      aria-label={`Convert "${idea.title}" to draft`}
                    >
                      Convert to Draft
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.deleteBtn}`}
                      onClick={() => handleDelete(idea)}
                      aria-label={`Delete ${idea.title}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← Prev
              </button>
              <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingIdea ? 'Edit Idea' : 'New Idea'}
        footer={
          <div className={styles.modalFooter}>
            <button className={styles.cancelBtn} onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        }
      >
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="idea-title">Title *</label>
          <input
            id="idea-title"
            className={styles.input}
            type="text"
            placeholder="Idea title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            maxLength={300}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="idea-description">Description</label>
          <textarea
            id="idea-description"
            className={styles.textarea}
            placeholder="Optional description…"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="idea-rating">
            Rating: <strong>{form.rating}/10</strong>
          </label>
          <input
            id="idea-rating"
            className={styles.ratingSlider}
            type="range"
            min={0}
            max={10}
            step={1}
            value={form.rating}
            onChange={(e) => setForm((f) => ({ ...f, rating: Number(e.target.value) }))}
          />
          <div className={styles.ratingLabels}>
            <span>0</span>
            <span className={styles.ratingBadgePreview}>
              <Badge variant={getRatingVariant(form.rating)}>{form.rating}/10</Badge>
            </span>
            <span>10</span>
          </div>
        </div>
        {users.length > 0 && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Share with users</label>
            <div className={styles.userList}>
              {users.map((user) => (
                <label key={user.id} className={styles.userCheckbox}>
                  <input
                    type="checkbox"
                    checked={form.shared_with.includes(user.id)}
                    onChange={() => toggleSharedWith(user.id)}
                  />
                  <span>{user.name}</span>
                  <span className={styles.userEmail}>{user.email}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

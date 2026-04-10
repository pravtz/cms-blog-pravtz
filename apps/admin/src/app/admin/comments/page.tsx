'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './page.module.css'
import { Badge } from '@/components'

interface Comment {
  id: string
  post_id: string
  post_title: string
  post_slug: string
  parent_id: string | null
  author_id: string
  author_name: string
  author_email: string
  content: string
  status: 'visible' | 'hidden' | 'flagged'
  upvotes: number
  downvotes: number
  created_at: string
}

const STATUS_BADGE: Record<string, { variant: 'success' | 'error' | 'warning'; label: string }> = {
  visible: { variant: 'success', label: 'Visible' },
  hidden: { variant: 'error', label: 'Hidden' },
  flagged: { variant: 'warning', label: 'Flagged' },
}

function formatDate(iso: string) {
  try {
    return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleString()
  } catch {
    return iso
  }
}

export default function CommentsPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [error, setError] = useState('')

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchComments = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    const params = new URLSearchParams({ limit: '50' })
    if (statusFilter !== 'all') params.set('status', statusFilter)

    try {
      const res = await fetch(`/api/admin/comments?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) throw new Error('Failed to load comments')
      const data = await res.json()
      setComments(data.comments)
      setTotal(data.total)
    } catch {
      setError('Failed to load comments.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const updateStatus = async (id: string, status: string) => {
    const token = getToken()
    const res = await fetch(`/api/admin/comments/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setComments((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: status as Comment['status'] } : c))
      )
    }
  }

  const deleteComment = async (id: string) => {
    if (!confirm('Permanently delete this comment? This cannot be undone.')) return
    const token = getToken()
    const res = await fetch(`/api/admin/comments/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== id))
      setTotal((t) => t - 1)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Comments</h1>
        <span className={styles.total}>{total} total</span>
      </div>

      {/* Status filter */}
      <div className={styles.filters} role="group" aria-label="Filter by status">
        {['all', 'visible', 'flagged', 'hidden'].map((s) => (
          <button
            key={s}
            className={`${styles.filterBtn} ${statusFilter === s ? styles.active : ''}`}
            onClick={() => setStatusFilter(s)}
            aria-pressed={statusFilter === s}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.loading}>Loading comments…</div>
      ) : comments.length === 0 ? (
        <p className={styles.empty}>No comments found.</p>
      ) : (
        <div className={styles.list}>
          {comments.map((comment) => (
            <article key={comment.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.meta}>
                  <span className={styles.author}>{comment.author_name}</span>
                  <span className={styles.email}>{comment.author_email}</span>
                  {comment.parent_id && (
                    <span className={styles.replyBadge}>reply</span>
                  )}
                </div>
                <div className={styles.metaRight}>
                  <Badge variant={STATUS_BADGE[comment.status]?.variant ?? 'default'}>
                    {STATUS_BADGE[comment.status]?.label ?? comment.status}
                  </Badge>
                  <time className={styles.date}>{formatDate(comment.created_at)}</time>
                </div>
              </div>

              <p className={styles.content}>{comment.content}</p>

              <div className={styles.postLink}>
                Post:{' '}
                <span className={styles.postTitle}>{comment.post_title}</span>
                <span className={styles.votes}>↑{comment.upvotes} ↓{comment.downvotes}</span>
              </div>

              <div className={styles.actions}>
                {comment.status !== 'visible' && (
                  <button
                    className={`${styles.actionBtn} ${styles.show}`}
                    onClick={() => updateStatus(comment.id, 'visible')}
                  >
                    Show
                  </button>
                )}
                {comment.status !== 'hidden' && (
                  <button
                    className={`${styles.actionBtn} ${styles.hide}`}
                    onClick={() => updateStatus(comment.id, 'hidden')}
                  >
                    Hide
                  </button>
                )}
                <button
                  className={`${styles.actionBtn} ${styles.delete}`}
                  onClick={() => deleteComment(comment.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

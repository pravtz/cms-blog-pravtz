'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import styles from './page.module.css'

interface Post {
  id: string
  title: string
  slug: string
  status: 'draft' | 'published' | 'scheduled'
  visibility: string
  language: string
  category_name: string | null
  author_name: string
  reading_time: number | null
  updated_at: string
  publish_date: string | null
  has_translation: number
}

interface PostsResponse {
  posts: Post[]
  total: number
  page: number
  limit: number
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  scheduled: 'Scheduled',
}

const VISIBILITY_LABELS: Record<string, string> = {
  public: 'Public',
  allPrivate: 'All Members',
  groupPrivate: 'Group',
  listPrivate: 'List',
  iPrivate: 'Only Me',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatCountdown(publishDate: string): string {
  const diff = new Date(publishDate).getTime() - Date.now()
  if (diff <= 0) return 'Publishing soon…'
  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins = Math.floor((diff % 3_600_000) / 60_000)
  if (days > 0) return `in ${days}d ${hours}h`
  if (hours > 0) return `in ${hours}h ${mins}m`
  return `in ${mins}m`
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    params.set('page', String(page))
    try {
      const res = await fetch(`/api/posts?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
      })
      if (res.status === 401) throw new Error('Sessão expirada, faça login novamente')
      if (!res.ok) throw new Error('Failed to load posts')
      const data: PostsResponse = await res.json()
      setPosts(data.posts)
      setTotal(data.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handlePublishToggle = async (post: Post) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published'
    setActionLoading(post.id)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.status === 401) throw new Error('Sessão expirada, faça login novamente')
      if (!res.ok) throw new Error('Update failed')
      await fetchPosts()
    } catch {
      alert('Failed to update post status')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (post: Post) => {
    if (!confirm(`Delete "${post.title || 'Untitled'}"? This cannot be undone.`)) return
    setActionLoading(post.id)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` },
      })
      if (res.status === 401) throw new Error('Sessão expirada, faça login novamente')
      if (!res.ok) throw new Error('Delete failed')
      await fetchPosts()
    } catch {
      alert('Failed to delete post')
    } finally {
      setActionLoading(null)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Posts</h1>
          <p className={styles.subtitle}>{total} total</p>
        </div>
        <Link href="/admin/posts/new" className={styles.newButton}>
          + New Post
        </Link>
      </div>

      <div className={styles.filters}>
        {['', 'draft', 'published', 'scheduled'].map((s) => (
          <button
            key={s}
            className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
            onClick={() => { setStatusFilter(s); setPage(1) }}
          >
            {s === '' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.loadingRows}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className={styles.empty}>
          <p>No posts found.</p>
          <Link href="/admin/posts/new">Create your first post</Link>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table} aria-label="Posts list">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Language</th>
                <th scope="col">Visibility</th>
                <th scope="col">Category</th>
                <th scope="col">Read time</th>
                <th scope="col">Updated</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id} className={actionLoading === post.id ? styles.rowBusy : ''}>
                  <td>
                    <Link href={`/admin/posts/${post.id}/edit`} className={styles.postTitle}>
                      {post.title || <em className={styles.untitled}>Untitled</em>}
                    </Link>
                    <span className={styles.slug}>{post.slug}</span>
                    {post.has_translation === 1 && (
                      <span className={styles.translationBadge} title="Has translation">🔗</span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[`status_${post.status}`]}`}>
                      {STATUS_LABELS[post.status] ?? post.status}
                    </span>
                    {post.status === 'scheduled' && post.publish_date && (
                      <span className={styles.countdown} title={new Date(post.publish_date).toLocaleString()}>
                        {formatCountdown(post.publish_date)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={styles.langBadge}>
                      {post.language === 'pt-BR' ? '🇧🇷 PT' : '🇬🇧 EN'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.visibilityBadge}>
                      {VISIBILITY_LABELS[post.visibility] ?? post.visibility}
                    </span>
                  </td>
                  <td className={styles.meta}>{post.category_name ?? '—'}</td>
                  <td className={styles.meta}>
                    {post.reading_time != null ? `${post.reading_time} min` : '—'}
                  </td>
                  <td className={styles.meta}>{formatDate(post.updated_at)}</td>
                  <td>
                    <div className={styles.actions}>
                      <Link
                        href={`/admin/posts/${post.id}/edit`}
                        className={styles.actionBtn}
                      >
                        Edit
                      </Link>
                      <button
                        className={`${styles.actionBtn} ${
                          post.status === 'published'
                            ? styles.actionBtnUnpublish
                            : styles.actionBtnPublish
                        }`}
                        onClick={() => handlePublishToggle(post)}
                        disabled={actionLoading === post.id}
                      >
                        {post.status === 'published' ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                        onClick={() => handleDelete(post)}
                        disabled={actionLoading === post.id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

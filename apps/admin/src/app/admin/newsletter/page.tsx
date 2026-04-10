'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './page.module.css'
import { Badge } from '@/components'

interface Subscriber {
  id: string
  email: string
  status: string
  confirmed_at: string | null
  created_at: string
}

const STATUS_BADGE: Record<string, { variant: 'success' | 'warning' | 'error' | 'default'; label: string }> = {
  active: { variant: 'success', label: 'Ativo' },
  pending: { variant: 'warning', label: 'Pendente' },
  unsubscribed: { variant: 'error', label: 'Cancelado' },
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

export default function NewsletterPage() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<string | null>(null)

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchSubscribers = useCallback(async () => {
    setLoading(true)
    setError('')
    const token = getToken()
    const params = new URLSearchParams({ limit: '50', page: String(page) })
    if (statusFilter !== 'all') params.set('status', statusFilter)

    try {
      const res = await fetch(`/api/admin/newsletter?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Falha ao carregar inscritos')
      const data = await res.json()
      setSubscribers(data.data)
      setTotal(data.meta.total)
      setTotalPages(data.meta.totalPages)
    } catch {
      setError('Erro ao carregar inscritos.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, page])

  useEffect(() => {
    fetchSubscribers()
  }, [fetchSubscribers])

  const handleRemove = async (id: string) => {
    if (!confirm('Remover este inscrito permanentemente?')) return
    setRemoving(id)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      setSubscribers((prev) => prev.filter((s) => s.id !== id))
      setTotal((t) => t - 1)
    } catch {
      alert('Erro ao remover inscrito.')
    } finally {
      setRemoving(null)
    }
  }

  const handleExport = () => {
    const token = getToken()
    const params = new URLSearchParams({ export: 'csv' })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    // Open in new tab; Authorization header not possible for direct download
    // Use a fetch-based approach to trigger download
    fetch(`/api/admin/newsletter?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'newsletter-subscribers.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => alert('Erro ao exportar CSV.'))
  }

  const STATUS_TABS = [
    { key: 'all', label: 'Todos' },
    { key: 'active', label: 'Ativos' },
    { key: 'pending', label: 'Pendentes' },
    { key: 'unsubscribed', label: 'Cancelados' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Newsletter</h1>
          <p className={styles.subtitle}>{total} inscrito{total !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.exportBtn} onClick={handleExport}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Exportar CSV
        </button>
      </div>

      <div className={styles.tabs} role="tablist">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={statusFilter === tab.key}
            className={`${styles.tab} ${statusFilter === tab.key ? styles.tabActive : ''}`}
            onClick={() => { setStatusFilter(tab.key); setPage(1) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      ) : subscribers.length === 0 ? (
        <div className={styles.empty}>
          <p>Nenhum inscrito encontrado.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Status</th>
                  <th>Confirmado em</th>
                  <th>Inscrito em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {subscribers.map((s) => {
                  const badge = STATUS_BADGE[s.status] ?? { variant: 'default' as const, label: s.status }
                  return (
                    <tr key={s.id}>
                      <td className={styles.emailCell}>{s.email}</td>
                      <td>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className={styles.dateCell}>{formatDate(s.confirmed_at)}</td>
                      <td className={styles.dateCell}>{formatDate(s.created_at)}</td>
                      <td>
                        <button
                          className={styles.removeBtn}
                          onClick={() => handleRemove(s.id)}
                          disabled={removing === s.id}
                          aria-label={`Remover ${s.email}`}
                        >
                          {removing === s.id ? '…' : 'Remover'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <span className={styles.pageInfo}>
                Página {page} de {totalPages}
              </span>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

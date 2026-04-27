'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'

interface AuditLog {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  target_id: string | null
  target_type: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface AuditResponse {
  logs: AuditLog[]
  total: number
  page: number
  limit: number
}

const ACTION_LABELS: Record<string, string> = {
  'login.success': 'Login Success',
  'login.failure': 'Login Failure',
  'login.blocked': 'Login Blocked',
  'user.approved': 'User Approved',
  'user.rejected': 'User Rejected',
  'user.suspended': 'User Suspended',
  'user.role_changed': 'Role Changed',
  'post.created': 'Post Created',
  'post.published': 'Post Published',
  'post.edited': 'Post Edited',
  'post.deleted': 'Post Deleted',
  'group.created': 'Group Created',
  'group.updated': 'Group Updated',
  'group.deleted': 'Group Deleted',
  'rbac.group_permissions_changed': 'Group Permissions Changed',
  'rbac.user_permissions_changed': 'User Permissions Changed',
  'settings.changed': 'Settings Changed',
  'setup.completed': 'Setup Completed',
}

const ACTION_COLORS: Record<string, string> = {
  'login.success': '#22c55e',
  'login.failure': '#f97316',
  'login.blocked': '#ef4444',
  'user.approved': '#22c55e',
  'user.rejected': '#ef4444',
  'user.suspended': '#ef4444',
  'post.deleted': '#ef4444',
  'group.deleted': '#ef4444',
}

function getActionColor(action: string): string {
  return ACTION_COLORS[action] ?? '#6366f1'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterAction, setFilterAction] = useState('')
  const [filterActorEmail, setFilterActorEmail] = useState('')
  const [filterTargetType, setFilterTargetType] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(pageNum) })
      if (filterAction) params.set('action', filterAction)
      if (filterActorEmail) params.set('actorEmail', filterActorEmail)
      if (filterTargetType) params.set('targetType', filterTargetType)
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)

      const res = await fetch(`/api/admin/audit-log?${params}`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? 'Failed to load audit logs')
        return
      }
      const data: AuditResponse = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
      setPage(data.page)
    } catch {
      setError('Failed to load audit logs')
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterActorEmail, filterTargetType, filterFrom, filterTo, accessToken])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  const totalPages = Math.ceil(total / 50)

  return (
    <main style={{ padding: '32px', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '8px' }}>Audit Trail</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
        All sensitive actions in the system. Visible to Owner only.
      </p>

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '12px',
        marginBottom: '24px',
        padding: '20px',
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border)',
      }}>
        <div>
          <label htmlFor="audit-filter-action" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Action
          </label>
          <select
            id="audit-filter-action"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              width: '100%', padding: '8px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-primary)', fontSize: '0.875rem',
            }}
          >
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="audit-filter-actor-email" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Actor Email
          </label>
          <input
            id="audit-filter-actor-email"
            type="text"
            value={filterActorEmail}
            onChange={(e) => setFilterActorEmail(e.target.value)}
            placeholder="Search email..."
            style={{
              width: '100%', padding: '8px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-primary)', fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label htmlFor="audit-filter-target-type" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            Target Type
          </label>
          <select
            id="audit-filter-target-type"
            value={filterTargetType}
            onChange={(e) => setFilterTargetType(e.target.value)}
            style={{
              width: '100%', padding: '8px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-primary)', fontSize: '0.875rem',
            }}
          >
            <option value="">All types</option>
            <option value="user">User</option>
            <option value="post">Post</option>
            <option value="group">Group</option>
          </select>
        </div>

        <div>
          <label htmlFor="audit-filter-from" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            From
          </label>
          <input
            id="audit-filter-from"
            type="datetime-local"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            style={{
              width: '100%', padding: '8px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-primary)', fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label htmlFor="audit-filter-to" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            To
          </label>
          <input
            id="audit-filter-to"
            type="datetime-local"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            style={{
              width: '100%', padding: '8px', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-primary)', fontSize: '0.875rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => fetchLogs(1)}
            style={{
              padding: '8px 16px', background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600,
            }}
          >
            Apply
          </button>
          <button
            onClick={() => {
              setFilterAction('')
              setFilterActorEmail('')
              setFilterTargetType('')
              setFilterFrom('')
              setFilterTo('')
            }}
            style={{
              padding: '8px 16px', background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
        {loading ? 'Loading...' : `${total} event${total !== 1 ? 's' : ''} found`}
      </div>

      {error && (
        <div style={{
          padding: '16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '8px', color: '#ef4444', marginBottom: '16px',
        }}>
          {error}
        </div>
      )}

      {/* Log Table */}
      {!loading && logs.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
          No audit events found.
        </div>
      )}

      {logs.length > 0 && (
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }} aria-label="Audit log">
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Timestamp</th>
                <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Action</th>
                <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Actor</th>
                <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Target</th>
                <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>IP</th>
                <th scope="col" style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: expandedId === log.id ? 'var(--bg-secondary)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(log.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px',
                        background: `${getActionColor(log.action)}22`,
                        color: getActionColor(log.action),
                        borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                        fontFamily: 'monospace',
                      }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                      {log.actor_email ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {log.target_type && log.target_id
                        ? `${log.target_type}:${log.target_id.slice(0, 8)}…`
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {log.ip_address ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {log.metadata && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          style={{
                            padding: '2px 8px', background: 'transparent',
                            border: '1px solid var(--border)', borderRadius: '4px',
                            color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem',
                          }}
                        >
                          {expandedId === log.id ? 'Hide' : 'Show'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && log.metadata && (
                    <tr key={`${log.id}-expanded`} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                      <td colSpan={6} style={{ padding: '12px 16px' }}>
                        <pre style={{
                          margin: 0, padding: '12px',
                          background: 'var(--bg-elevated)', borderRadius: '6px',
                          fontSize: '0.75rem', color: 'var(--text-primary)',
                          overflow: 'auto',
                        }}>
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                        {log.user_agent && (
                          <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            User-Agent: {log.user_agent}
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '24px' }}>
          <button
            disabled={page <= 1}
            onClick={() => fetchLogs(page - 1)}
            style={{
              padding: '8px 16px', background: page <= 1 ? 'var(--bg-secondary)' : 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: page <= 1 ? 'default' : 'pointer', fontSize: '0.875rem',
            }}
          >
            Previous
          </button>
          <span style={{ padding: '8px 16px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => fetchLogs(page + 1)}
            style={{
              padding: '8px 16px', background: page >= totalPages ? 'var(--bg-secondary)' : 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '0.875rem',
            }}
          >
            Next
          </button>
        </div>
      )}
    </main>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './page.module.css'
import { useToast } from '@/components'

interface Release {
  id: string
  version: string
  release_date: string
  type: 'major' | 'minor' | 'patch'
  changelog: string
  commit_url: string | null
  pr_url: string | null
  is_current: number
  created_at: string
  author_name: string
  author_email: string
}

const TYPE_LABELS: Record<string, string> = {
  major: 'Major',
  minor: 'Minor',
  patch: 'Patch',
}

interface ReleaseForm {
  version: string
  release_date: string
  type: 'major' | 'minor' | 'patch'
  changelog: string
  commit_url: string
  pr_url: string
  is_current: boolean
}

const EMPTY_FORM: ReleaseForm = {
  version: '',
  release_date: new Date().toISOString().slice(0, 10),
  type: 'patch',
  changelog: '',
  commit_url: '',
  pr_url: '',
  is_current: false,
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00Z')
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

export default function ReleasesPage() {
  const { toast } = useToast()
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ReleaseForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const user = JSON.parse(localStorage.getItem('currentUser') ?? '{}')
        setIsOwner(user.role === 'owner')
      } catch {
        setIsOwner(false)
      }
    }
  }, [])

  const fetchReleases = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/releases', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setReleases(data.releases ?? [])
      // Auto-expand current or latest
      const curr = data.releases?.find((r: Release) => r.is_current === 1)
      if (curr) setExpandedId(curr.id)
      else if (data.releases?.length > 0) setExpandedId(data.releases[0].id)
    } catch {
      toast({ variant: 'error', title: 'Failed to load releases.' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchReleases()
  }, [fetchReleases])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(r: Release) {
    setEditingId(r.id)
    setForm({
      version: r.version,
      release_date: r.release_date.slice(0, 10),
      type: r.type,
      changelog: r.changelog,
      commit_url: r.commit_url ?? '',
      pr_url: r.pr_url ?? '',
      is_current: r.is_current === 1,
    })
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (!form.version.trim() || !form.release_date || !form.changelog.trim()) {
      toast({ variant: 'error', title: 'Version, date, and changelog are required.' })
      return
    }
    setSaving(true)
    const token = getToken()
    try {
      const url = editingId ? `/api/admin/releases/${editingId}` : '/api/admin/releases'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: form.version.trim(),
          release_date: form.release_date,
          type: form.type,
          changelog: form.changelog.trim(),
          commit_url: form.commit_url.trim() || null,
          pr_url: form.pr_url.trim() || null,
          is_current: form.is_current,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save')
      }
      toast({ variant: 'success', title: editingId ? 'Release updated.' : 'Release created.' })
      closeForm()
      fetchReleases()
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this release?')) return
    setDeleting(id)
    const token = getToken()
    try {
      const res = await fetch(`/api/admin/releases/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      toast({ variant: 'success', title: 'Release deleted.' })
      fetchReleases()
    } catch {
      toast({ variant: 'error', title: 'Failed to delete release.' })
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Releases</h1>
          <p className={styles.subtitle}>Version history and changelog for Nexus CMS.</p>
        </div>
        {isOwner && (
          <button className={styles.addBtn} onClick={openCreate} type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Release
          </button>
        )}
      </div>

      {/* Form modal */}
      {formOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="release-form-title">
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 id="release-form-title" className={styles.modalTitle}>
                {editingId ? 'Edit Release' : 'New Release'}
              </h2>
              <button className={styles.modalClose} onClick={closeForm} type="button" aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="rel-version">Version *</label>
                  <input
                    id="rel-version"
                    className={styles.input}
                    type="text"
                    placeholder="e.g. 1.2.0"
                    value={form.version}
                    onChange={(e) => setForm({ ...form, version: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="rel-date">Release Date *</label>
                  <input
                    id="rel-date"
                    className={styles.input}
                    type="date"
                    value={form.release_date}
                    onChange={(e) => setForm({ ...form, release_date: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="rel-type">Type</label>
                  <select
                    id="rel-type"
                    className={styles.select}
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as 'major' | 'minor' | 'patch' })}
                    disabled={saving}
                  >
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                    <option value="patch">Patch</option>
                  </select>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="rel-commit">Commit URL</label>
                  <input
                    id="rel-commit"
                    className={styles.input}
                    type="url"
                    placeholder="https://github.com/..."
                    value={form.commit_url}
                    onChange={(e) => setForm({ ...form, commit_url: e.target.value })}
                    disabled={saving}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="rel-pr">PR URL</label>
                  <input
                    id="rel-pr"
                    className={styles.input}
                    type="url"
                    placeholder="https://github.com/..."
                    value={form.pr_url}
                    onChange={(e) => setForm({ ...form, pr_url: e.target.value })}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="rel-changelog">Changelog (Markdown) *</label>
                <textarea
                  id="rel-changelog"
                  className={styles.textarea}
                  placeholder="## What's new&#10;&#10;- Feature A&#10;- Bug fix B"
                  value={form.changelog}
                  onChange={(e) => setForm({ ...form, changelog: e.target.value })}
                  disabled={saving}
                  rows={10}
                />
              </div>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.is_current}
                  onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
                  disabled={saving}
                />
                Mark as current version
              </label>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.cancelBtn} onClick={closeForm} disabled={saving} type="button">
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving || !form.version.trim() || !form.changelog.trim()}
                type="button"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Release'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Releases list */}
      {loading ? (
        <div className={styles.skeleton} />
      ) : releases.length === 0 ? (
        <div className={styles.empty}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={styles.emptyIcon}>
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <p className={styles.emptyText}>No releases yet.</p>
          {isOwner && (
            <button className={styles.addBtn} onClick={openCreate} type="button">
              Create first release
            </button>
          )}
        </div>
      ) : (
        <div className={styles.timeline}>
          {releases.map((r) => {
            const isExpanded = expandedId === r.id
            return (
              <article key={r.id} className={`${styles.releaseCard} ${r.is_current ? styles.isCurrent : ''}`}>
                <div
                  className={styles.releaseHeader}
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : r.id) } }}
                >
                  <div className={styles.releaseHeaderLeft}>
                    <span className={`${styles.typeBadge} ${styles[`type_${r.type}`]}`}>
                      {TYPE_LABELS[r.type]}
                    </span>
                    <span className={styles.versionText}>v{r.version}</span>
                    {r.is_current === 1 && (
                      <span className={styles.currentBadge} aria-label="Current version">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Current
                      </span>
                    )}
                    <span className={styles.releaseDate}>{formatDate(r.release_date)}</span>
                    {(r.commit_url || r.pr_url) && (
                      <span className={styles.links}>
                        {r.commit_url && (
                          <a
                            href={r.commit_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.link}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="View commits"
                          >
                            Commits
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                        {r.pr_url && (
                          <a
                            href={r.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.link}
                            onClick={(e) => e.stopPropagation()}
                            aria-label="View pull request"
                          >
                            PR
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                      </span>
                    )}
                  </div>

                  <div className={styles.releaseHeaderRight}>
                    {isOwner && (
                      <>
                        <button
                          className={styles.iconBtn}
                          onClick={(e) => { e.stopPropagation(); openEdit(r) }}
                          type="button"
                          aria-label="Edit release"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
                          type="button"
                          disabled={deleting === r.id}
                          aria-label="Delete release"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      </>
                    )}
                    <svg
                      width="14" height="14"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      className={`${styles.chevron} ${isExpanded ? styles.chevronUp : ''}`}
                      aria-hidden="true"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className={styles.releaseBody}>
                    <div className={styles.markdownBody}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {r.changelog}
                      </ReactMarkdown>
                    </div>
                    <p className={styles.releaseMeta}>
                      Released by {r.author_name || r.author_email} · {formatDate(r.release_date)}
                    </p>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

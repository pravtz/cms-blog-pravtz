'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import styles from './page.module.css'

interface Version {
  id: string
  version_number: number
  title: string | null
  status: string | null
  change_summary: string | null
  created_at: string
  author_name: string | null
}

interface VersionDetail {
  id: string
  version_number: number
  title: string | null
  subtitle: string | null
  excerpt: string | null
  content: string | null
  status: string | null
  visibility: string | null
  language: string | null
  change_summary: string | null
  created_at: string
  author_name: string | null
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Simple line-based diff: returns segments marked as added, removed, or unchanged */
function computeLineDiff(
  oldText: string,
  newText: string
): Array<{ type: 'added' | 'removed' | 'unchanged'; line: string }> {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result: Array<{ type: 'added' | 'removed' | 'unchanged'; line: string }> = []

  // LCS-based diff (simplified: just show removed then added for changed blocks)
  // Use a greedy approach for display
  let oi = 0
  let ni = 0
  while (oi < oldLines.length || ni < newLines.length) {
    if (oi < oldLines.length && ni < newLines.length && oldLines[oi] === newLines[ni]) {
      result.push({ type: 'unchanged', line: oldLines[oi] })
      oi++
      ni++
    } else {
      // Look ahead for matching lines (up to 3)
      let matched = false
      for (let ahead = 1; ahead <= 3 && !matched; ahead++) {
        if (oi + ahead < oldLines.length && oldLines[oi + ahead] === newLines[ni]) {
          for (let k = 0; k < ahead; k++) result.push({ type: 'removed', line: oldLines[oi + k] })
          oi += ahead
          matched = true
        } else if (ni + ahead < newLines.length && oldLines[oi] === newLines[ni + ahead]) {
          for (let k = 0; k < ahead; k++) result.push({ type: 'added', line: newLines[ni + k] })
          ni += ahead
          matched = true
        }
      }
      if (!matched) {
        if (oi < oldLines.length) { result.push({ type: 'removed', line: oldLines[oi++] }) }
        if (ni < newLines.length) { result.push({ type: 'added', line: newLines[ni++] }) }
      }
    }
  }
  return result
}

export default function PostVersionsPage() {
  const { id } = useParams<{ id: string }>()
  const [versions, setVersions] = useState<Version[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedA, setSelectedA] = useState<VersionDetail | null>(null)
  const [selectedB, setSelectedB] = useState<VersionDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [diffMode, setDiffMode] = useState(false)

  const fetchVersions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/posts/${id}/versions`)
      if (!res.ok) throw new Error('Failed to load versions')
      const data = await res.json()
      setVersions(data.versions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  const loadVersionDetail = async (versionId: string): Promise<VersionDetail | null> => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/posts/${id}/versions/${versionId}`)
      if (!res.ok) return null
      const data = await res.json()
      return data.version ?? null
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleSelectForDiff = async (version: Version, slot: 'A' | 'B') => {
    const detail = await loadVersionDetail(version.id)
    if (!detail) return
    if (slot === 'A') setSelectedA(detail)
    else setSelectedB(detail)
    setDiffMode(true)
  }

  const handleRestore = async (version: Version) => {
    if (
      !confirm(
        `Restore to v${version.version_number}: "${version.title ?? 'Untitled'}"?\n\nThe current state will be saved as a new version first.`
      )
    )
      return
    setRestoring(version.id)
    try {
      const res = await fetch(`/api/posts/${id}/versions/${version.id}/restore`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Restore failed')
      await fetchVersions()
      setDiffMode(false)
      setSelectedA(null)
      setSelectedB(null)
      alert('Version restored successfully.')
    } catch {
      alert('Failed to restore version.')
    } finally {
      setRestoring(null)
    }
  }

  const diffLines =
    diffMode && selectedA && selectedB
      ? computeLineDiff(selectedA.content ?? '', selectedB.content ?? '')
      : null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Version History</h1>
          <p className={styles.subtitle}>{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={styles.headerActions}>
          <Link href={`/admin/posts/${id}/edit`} className={styles.backLink}>
            ← Back to editor
          </Link>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.layout}>
        {/* Version list */}
        <div className={styles.versionList}>
          <h2 className={styles.sectionTitle}>Versions</h2>
          {loading ? (
            <div className={styles.loading}>Loading…</div>
          ) : versions.length === 0 ? (
            <div className={styles.empty}>No versions saved yet. Save or publish the post to create a version.</div>
          ) : (
            <ul className={styles.list}>
              {versions.map((v) => (
                <li key={v.id} className={styles.versionItem}>
                  <div className={styles.versionMeta}>
                    <span className={styles.versionNum}>v{v.version_number}</span>
                    <span className={`${styles.statusBadge} ${styles[`status_${v.status ?? 'draft'}`]}`}>
                      {v.status ?? 'draft'}
                    </span>
                  </div>
                  <div className={styles.versionTitle}>{v.title || <em>Untitled</em>}</div>
                  <div className={styles.versionSummary}>{v.change_summary ?? '—'}</div>
                  <div className={styles.versionInfo}>
                    {formatDate(v.created_at)} · {v.author_name ?? 'Unknown'}
                  </div>
                  <div className={styles.versionActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleSelectForDiff(v, 'A')}
                      disabled={loadingDetail}
                    >
                      Compare (A)
                    </button>
                    <button
                      className={styles.actionBtn}
                      onClick={() => handleSelectForDiff(v, 'B')}
                      disabled={loadingDetail}
                    >
                      Compare (B)
                    </button>
                    <button
                      className={`${styles.actionBtn} ${styles.restoreBtn}`}
                      onClick={() => handleRestore(v)}
                      disabled={restoring === v.id}
                    >
                      {restoring === v.id ? 'Restoring…' : 'Restore'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Diff view */}
        <div className={styles.diffPanel}>
          {!diffMode ? (
            <div className={styles.diffPlaceholder}>
              Select two versions to compare them side by side.
            </div>
          ) : (
            <>
              <div className={styles.diffHeader}>
                <div className={styles.diffSlot}>
                  <strong>Version A:</strong>{' '}
                  {selectedA ? `v${selectedA.version_number} — ${selectedA.title ?? 'Untitled'}` : 'Not selected'}
                </div>
                <div className={styles.diffSlot}>
                  <strong>Version B:</strong>{' '}
                  {selectedB ? `v${selectedB.version_number} — ${selectedB.title ?? 'Untitled'}` : 'Not selected'}
                </div>
                <button
                  className={styles.closeDiffBtn}
                  onClick={() => { setDiffMode(false); setSelectedA(null); setSelectedB(null) }}
                >
                  ✕ Close diff
                </button>
              </div>

              {/* Metadata diff */}
              {selectedA && selectedB && (
                <div className={styles.metaDiff}>
                  {selectedA.title !== selectedB.title && (
                    <div className={styles.metaChange}>
                      <span className={styles.metaLabel}>Title:</span>
                      <span className={styles.removed}>{selectedA.title}</span>
                      <span className={styles.arrow}>→</span>
                      <span className={styles.added}>{selectedB.title}</span>
                    </div>
                  )}
                  {selectedA.status !== selectedB.status && (
                    <div className={styles.metaChange}>
                      <span className={styles.metaLabel}>Status:</span>
                      <span className={styles.removed}>{selectedA.status}</span>
                      <span className={styles.arrow}>→</span>
                      <span className={styles.added}>{selectedB.status}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Content diff */}
              {diffLines && (
                <div className={styles.diffContent}>
                  <h3 className={styles.diffContentTitle}>Content diff</h3>
                  <pre className={styles.diffPre}>
                    {diffLines.map((seg, i) => (
                      <div
                        key={i}
                        className={
                          seg.type === 'added'
                            ? styles.lineAdded
                            : seg.type === 'removed'
                            ? styles.lineRemoved
                            : styles.lineUnchanged
                        }
                      >
                        <span className={styles.linePrefix}>
                          {seg.type === 'added' ? '+' : seg.type === 'removed' ? '-' : ' '}
                        </span>
                        {seg.line}
                      </div>
                    ))}
                  </pre>
                </div>
              )}

              {loadingDetail && <div className={styles.loading}>Loading version…</div>}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

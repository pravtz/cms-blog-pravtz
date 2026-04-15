'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Mermaid } from 'mermaid'
import styles from './page.module.css'
import { useToast } from '@/components'

type DiagramLevel = 'context' | 'container' | 'component'

interface DiagramVersion {
  id: string
  level: string
  source: string
  version: number
  is_current: number
  created_at: string
  author_name: string
  author_email: string
}

interface CurrentDiagram {
  id: string
  level: string
  source: string
  author_id: string
  version: number
  created_at: string
}

const LEVEL_LABELS: Record<DiagramLevel, string> = {
  context: 'Context',
  container: 'Container',
  component: 'Component',
}

const DEFAULT_SOURCES: Record<DiagramLevel, string> = {
  context: `C4Context
    title System Context Diagram — Nexus CMS
    Person(user, "Visitor", "Reads public blog posts")
    Person(editor, "Editor", "Creates and manages content")
    Person(owner, "Owner", "Manages the system")
    System(nexus, "Nexus CMS", "Self-hosted editorial CMS with MDX editor, RBAC, and AI features")
    System_Ext(smtp, "SMTP Server", "Email delivery")
    System_Ext(ai, "AI Provider", "OpenAI / Anthropic")
    Rel(user, nexus, "Reads posts", "HTTPS")
    Rel(editor, nexus, "Creates content", "HTTPS")
    Rel(owner, nexus, "Administers", "HTTPS")
    Rel(nexus, smtp, "Sends emails", "SMTP")
    Rel(nexus, ai, "AI features", "HTTPS/REST")`,
  container: `C4Container
    title Container Diagram — Nexus CMS
    Person(user, "Visitor")
    Person(admin, "Admin / Editor")
    Container(blog, "Public Blog", "Next.js SSG", "Serves static blog pages to visitors")
    Container(adminApp, "Admin Panel", "Next.js", "Editorial and management UI")
    ContainerDb(db, "SQLite Database", "better-sqlite3 + WAL", "Posts, users, settings, audit log")
    Container(redis, "Redis", "Redis 7", "Rate limiting, caching")
    Container(nginx, "Nginx", "Nginx 1.25", "Reverse proxy, TLS termination, rate limiting")
    Rel(user, nginx, "HTTPS")
    Rel(admin, nginx, "HTTPS")
    Rel(nginx, blog, "Proxy", "HTTP")
    Rel(nginx, adminApp, "Proxy", "HTTP")
    Rel(adminApp, db, "Read / Write", "File I/O")
    Rel(adminApp, redis, "Rate limit", "TCP")`,
  component: `C4Component
    title Component Diagram — Admin Panel
    Container(adminApp, "Admin Panel", "Next.js App Router")
    Component(auth, "Auth Module", "JWT + bcrypt", "Login, registration, refresh tokens")
    Component(rbac, "RBAC Module", "Middleware", "Permission checks on every route")
    Component(editor, "MDX Editor", "CodeMirror 6", "Post editing with AI autocomplete")
    Component(ai, "AI Service", "Server Actions", "Ghost Writer, Translator, Image Gen, Trends")
    Component(api, "Public API v1", "Next.js Route Handlers", "Rate-limited REST API for posts/categories/tags")
    Component(email, "Email Service", "Nodemailer", "Transactional and newsletter emails")
    Rel(auth, rbac, "Issues JWT claims")
    Rel(editor, ai, "AI suggestions")
    Rel(adminApp, auth, "Uses")
    Rel(adminApp, rbac, "Uses")
    Rel(adminApp, editor, "Uses")
    Rel(adminApp, email, "Uses")
    Rel(adminApp, api, "Serves")`,
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function C4ModelPage() {
  const { toast } = useToast()
  const [activeLevel, setActiveLevel] = useState<DiagramLevel>('context')
  const [currentDiagram, setCurrentDiagram] = useState<CurrentDiagram | null>(null)
  const [source, setSource] = useState('')
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isOwner, setIsOwner] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<DiagramVersion[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  const mermaidRef = useRef<Mermaid | null>(null)
  const renderCountRef = useRef(0)

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  // Detect if current user is owner
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

  // Load mermaid dynamically
  useEffect(() => {
    import('mermaid').then((m) => {
      const mermaid = m.default as Mermaid
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        fontFamily: 'Inter, sans-serif',
      })
      mermaidRef.current = mermaid
    })
  }, [])

  const renderDiagram = useCallback(async (src: string) => {
    if (!mermaidRef.current || !src.trim()) {
      setRenderedSvg(null)
      setRenderError(null)
      return
    }
    try {
      renderCountRef.current += 1
      const id = `mermaid-${renderCountRef.current}`
      const { svg } = await mermaidRef.current.render(id, src)
      setRenderedSvg(svg)
      setRenderError(null)
    } catch (e: unknown) {
      setRenderedSvg(null)
      setRenderError(e instanceof Error ? e.message : 'Render error')
    }
  }, [])

  const fetchDiagram = useCallback(async (level: DiagramLevel) => {
    setLoading(true)
    setRenderedSvg(null)
    setRenderError(null)
    const token = getToken()
    try {
      const res = await fetch(`/api/admin/c4?level=${level}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.diagram) {
        setCurrentDiagram(data.diagram)
        setSource(data.diagram.source)
        await renderDiagram(data.diagram.source)
      } else {
        setCurrentDiagram(null)
        setSource(DEFAULT_SOURCES[level])
        await renderDiagram(DEFAULT_SOURCES[level])
      }
    } catch {
      toast({ variant: 'error', title: 'Failed to load diagram.' })
    } finally {
      setLoading(false)
    }
  }, [toast, renderDiagram])

  useEffect(() => {
    fetchDiagram(activeLevel)
    setHistory([])
    setHistoryOpen(false)
  }, [activeLevel, fetchDiagram])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    const token = getToken()
    try {
      const res = await fetch(`/api/admin/c4/history?level=${activeLevel}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setHistory(data.versions ?? [])
    } catch {
      toast({ variant: 'error', title: 'Failed to load history.' })
    } finally {
      setHistoryLoading(false)
    }
  }, [activeLevel, toast])

  function toggleHistory() {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next && history.length === 0) {
      fetchHistory()
    }
  }

  async function handlePreview() {
    await renderDiagram(source)
  }

  async function handleSave() {
    if (!source.trim()) {
      toast({ variant: 'error', title: 'Source cannot be empty.' })
      return
    }
    setSaving(true)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/c4', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: activeLevel, source }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save')
      }
      const saved: CurrentDiagram = await res.json()
      setCurrentDiagram(saved)
      toast({ variant: 'success', title: `C4 ${LEVEL_LABELS[activeLevel]} diagram saved (v${saved.version}).` })
      await renderDiagram(source)
      // Refresh history if open
      if (historyOpen) fetchHistory()
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore(versionId: string) {
    setRestoring(versionId)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/c4/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to restore')
      }
      const restored: CurrentDiagram = await res.json()
      setCurrentDiagram(restored)
      setSource(restored.source)
      await renderDiagram(restored.source)
      toast({ variant: 'success', title: `Restored to v${restored.version}.` })
      fetchHistory()
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Failed to restore.' })
    } finally {
      setRestoring(null)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>C4 Architecture Model</h1>
          <p className={styles.subtitle}>
            Visualize system architecture at Context, Container, and Component levels using Mermaid C4 syntax.
          </p>
        </div>
      </div>

      {/* Level tabs */}
      <div className={styles.tabs} role="tablist" aria-label="C4 diagram levels">
        {(Object.keys(LEVEL_LABELS) as DiagramLevel[]).map((level) => (
          <button
            key={level}
            role="tab"
            aria-selected={activeLevel === level}
            className={`${styles.tab} ${activeLevel === level ? styles.tabActive : ''}`}
            onClick={() => setActiveLevel(level)}
          >
            {LEVEL_LABELS[level]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.skeleton} />
      ) : (
        <div className={styles.layout}>
          {/* Diagram preview */}
          <div className={styles.diagramPanel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>
                C4 {LEVEL_LABELS[activeLevel]} Diagram
              </span>
              {currentDiagram && (
                <span className={styles.panelMeta}>
                  v{currentDiagram.version} · {formatDate(currentDiagram.created_at)}
                </span>
              )}
            </div>
            <div className={styles.diagramContainer}>
              {renderError ? (
                <div className={styles.diagramError}>
                  <strong>Render error:</strong> {renderError}
                </div>
              ) : renderedSvg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                  style={{ width: '100%', overflowX: 'auto' }}
                />
              ) : (
                <div className={styles.diagramEmpty}>
                  <svg
                    className={styles.diagramEmptyIcon}
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                  <p>No diagram yet. Enter Mermaid C4 source and click Preview or Save.</p>
                </div>
              )}
            </div>
          </div>

          {/* Editor + history panel */}
          <div className={styles.editorPanel}>
            <div className={styles.editorCard}>
              <div className={styles.editorHeader}>
                <span className={styles.editorTitle}>Diagram Source</span>
                {!isOwner && (
                  <span className={styles.editorOwnerNote}>Owner only — read-only</span>
                )}
              </div>
              <div className={styles.editorBody}>
                <textarea
                  className={styles.textarea}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={!isOwner || saving}
                  aria-label={`C4 ${LEVEL_LABELS[activeLevel]} diagram source`}
                  spellCheck={false}
                />
                <p className={styles.hint}>
                  Uses{' '}
                  <span className={styles.hintCode}>C4Context</span>,{' '}
                  <span className={styles.hintCode}>C4Container</span>, or{' '}
                  <span className={styles.hintCode}>C4Component</span>{' '}
                  Mermaid syntax.
                </p>
              </div>
              {isOwner && (
                <div className={styles.editorActions}>
                  <button
                    className={styles.previewBtn}
                    onClick={handlePreview}
                    disabled={saving}
                    type="button"
                  >
                    Preview
                  </button>
                  <button
                    className={styles.saveBtn}
                    onClick={handleSave}
                    disabled={saving || !source.trim()}
                    type="button"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            {/* Version history */}
            <div className={styles.historyCard}>
              <div
                className={styles.historyHeader}
                onClick={toggleHistory}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleHistory() }}
                aria-expanded={historyOpen}
              >
                <span className={styles.historyTitle}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  Version History
                </span>
                <span className={styles.historyToggle}>{historyOpen ? '▲' : '▼'}</span>
              </div>

              {historyOpen && (
                <div className={styles.historyList}>
                  {historyLoading ? (
                    <div className={styles.diagramEmpty} style={{ minHeight: 80, padding: 'var(--space-4)' }}>
                      Loading…
                    </div>
                  ) : history.length === 0 ? (
                    <div className={styles.diagramEmpty} style={{ minHeight: 80, padding: 'var(--space-4)' }}>
                      No versions saved yet.
                    </div>
                  ) : (
                    history.map((v) => (
                      <div key={v.id} className={styles.historyItem}>
                        <div className={styles.historyItemInfo}>
                          <div className={styles.historyVersion}>
                            v{v.version}
                            {v.is_current === 1 && (
                              <span className={styles.currentBadge}>current</span>
                            )}
                          </div>
                          <div className={styles.historyAuthor}>
                            {v.author_name || v.author_email} · {formatDate(v.created_at)}
                          </div>
                        </div>
                        {isOwner && v.is_current !== 1 && (
                          <button
                            className={styles.restoreBtn}
                            onClick={() => handleRestore(v.id)}
                            disabled={restoring !== null}
                            type="button"
                          >
                            {restoring === v.id ? '…' : 'Restore'}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Info box */}
            <div className={styles.infoBox}>
              <svg
                className={styles.infoIcon}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>
                This diagram is updated per release to reflect the current system architecture.
                Diagrams are versioned — each save creates a new version. Owners can restore any previous version.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

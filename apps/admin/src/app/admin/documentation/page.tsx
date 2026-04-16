'use client'

import { useState, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './page.module.css'
import { useToast } from '@/components'

const DEFAULT_CONTENT = `# Nexus CMS — System Documentation

## Overview

Nexus CMS is a self-hosted, Docker-based content management system designed for editorial blogs. It features an MDX editor with AI assistance, role-based access control (RBAC), a public SSG blog frontend, and a comprehensive admin panel.

## Architecture

The system is composed of four main services orchestrated with Docker Compose:

| Service | Technology | Port |
|---------|-----------|------|
| Admin Panel | Next.js 14 (App Router) | 3001 |
| Public Blog | Next.js 14 (SSG) | 3000 |
| Database | SQLite (better-sqlite3, WAL) | — |
| Cache | Redis 7 | 6379 |
| Reverse Proxy | Nginx 1.25 | 80/443 |

## Authentication

- **JWT tokens**: Short-lived access tokens (15 min) + long-lived refresh tokens (7 days, httpOnly cookie, rotated on use)
- **Brute-force protection**: 5 failures per 15 minutes → 30-minute IP block
- **Status machine**: \`pending_email\` → \`pending_approval\` → \`active\` → \`suspended\`

## Role-Based Access Control (RBAC)

Permissions are resolved in this order:
1. **Owner role** — bypasses all checks
2. **Individual user overrides** — explicit allow/deny
3. **Group permissions** — any group granting = allow
4. **Default group** — system defaults

Resources: posts, comments, users, groups, permissions, tags, categories, images, newsletter, metrics, settings, notifications, AI.

## Content Pipeline

1. Author writes MDX in the split-view editor (CodeMirror 6)
2. Content is sanitized server-side (sanitize-html) before storing
3. On publish, Shiki syntax highlighting is applied server-side
4. The public blog receives pre-rendered HTML via the Admin API

## AI Features

Requires an AI provider (OpenAI or Anthropic) configured in **AI & Quotas**:

- **Ghost Writer**: Auto-complete triggered after 1.5s pause — Tab to accept
- **Image Generator**: DALL-E 3, 4 variations, with crop tool
- **Auto-translation**: pt-BR → EN draft with linked \`translationGroupId\`
- **Trends Analysis**: Topic growth analysis from post metadata

## Public API v1

Base URL: \`/api/v1/\`

Rate limit: 60 req/min per IP (Redis sliding window).

| Endpoint | Description |
|----------|-------------|
| \`GET /api/v1/posts\` | List public posts (pagination, filters) |
| \`GET /api/v1/posts/:slug\` | Single post with rendered HTML |
| \`GET /api/v1/categories\` | List all categories |
| \`GET /api/v1/tags\` | List all tags |
| \`GET /api/v1/docs\` | OpenAPI 3.0 specification |

## Environment Variables

See \`.env.example\` for all required variables. Key ones:

- \`JWT_SECRET\` — Secret for signing access tokens
- \`REFRESH_TOKEN_SECRET\` — Secret for refresh tokens
- \`ENCRYPTION_KEY\` — AES-256-GCM key for API key storage
- \`DATA_DIR\` — SQLite database directory (default: \`./data\`)
- \`REDIS_URL\` — Redis connection URL

## First Run

Navigate to \`/admin/setup\` to complete the First Run wizard:
1. **Owner registration** — primary admin account
2. **Blog identity** — site name, description, logo
3. **SMTP configuration** — optional email delivery
4. **Done** — redirected to the admin dashboard

## Maintenance

- **Database**: WAL mode is enabled for concurrent reads; backup the \`data/\` directory
- **Versions**: Each release updates this documentation. See the Releases screen for changelog
- **Security**: Run \`npm audit\` periodically; update base Docker images on each release
`

interface DocVersion {
  id: string
  content: string
  change_summary: string | null
  version: number
  is_current: number
  created_at: string
  author_name: string
  author_email: string
}

interface CurrentDoc {
  id: string
  content: string
  change_summary: string | null
  version: number
  created_at: string
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function DocumentationPage() {
  const { toast } = useToast()
  const [currentDoc, setCurrentDoc] = useState<CurrentDoc | null>(null)
  const [content, setContent] = useState(DEFAULT_CONTENT)
  const [changeSummary, setChangeSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<DocVersion[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  const getToken = () =>
    typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const user = JSON.parse(localStorage.getItem('currentUser') ?? '{}')
        setCanEdit(user.role === 'owner' || user.role === 'admin')
      } catch {
        setCanEdit(false)
      }
    }
  }, [])

  const fetchDoc = useCallback(async () => {
    setLoading(true)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/docs', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.doc) {
        setCurrentDoc(data.doc)
        setContent(data.doc.content)
      }
    } catch {
      toast({ variant: 'error', title: 'Failed to load documentation.' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchDoc()
  }, [fetchDoc])

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/docs/history?limit=20', {
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
  }, [toast])

  function toggleHistory() {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next && history.length === 0) fetchHistory()
  }

  async function handleSave() {
    if (!content.trim()) {
      toast({ variant: 'error', title: 'Content cannot be empty.' })
      return
    }
    setSaving(true)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/docs', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, change_summary: changeSummary || undefined }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to save')
      }
      const saved: CurrentDoc = await res.json()
      setCurrentDoc(saved)
      setChangeSummary('')
      setIsEditing(false)
      toast({ variant: 'success', title: `Documentation saved (v${saved.version}).` })
      if (historyOpen) fetchHistory()
    } catch (e: unknown) {
      toast({ variant: 'error', title: e instanceof Error ? e.message : 'Failed to save.' })
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setContent(currentDoc?.content ?? DEFAULT_CONTENT)
    setChangeSummary('')
    setIsEditing(false)
  }

  async function handleRestore(versionId: string) {
    setRestoring(versionId)
    const token = getToken()
    try {
      const res = await fetch('/api/admin/docs/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to restore')
      }
      const restored: CurrentDoc = await res.json()
      setCurrentDoc(restored)
      setContent(restored.content)
      setIsEditing(false)
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
          <h1 className={styles.title}>System Documentation</h1>
          <p className={styles.subtitle}>
            System documentation rendered as Markdown. Editable by users with settings permission.
          </p>
        </div>
        <div className={styles.headerRight}>
          {currentDoc && (
            <span className={styles.versionBadge}>
              v{currentDoc.version} · {formatDate(currentDoc.created_at)}
            </span>
          )}
          {canEdit && !isEditing && (
            <button
              className={styles.editBtn}
              onClick={() => setIsEditing(true)}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
          <button
            className={`${styles.historyToggleBtn} ${historyOpen ? styles.historyToggleBtnActive : ''}`}
            onClick={toggleHistory}
            type="button"
            aria-expanded={historyOpen}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.skeleton} />
      ) : (
        <div className={`${styles.layout} ${historyOpen ? styles.layoutWithHistory : ''}`}>
          {/* Main content area */}
          <div className={styles.mainPanel}>
            {isEditing ? (
              <div className={styles.editorCard}>
                <div className={styles.editorHeader}>
                  <span className={styles.editorTitle}>Edit Documentation</span>
                </div>
                <div className={styles.editorBody}>
                  <textarea
                    className={styles.textarea}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    disabled={saving}
                    aria-label="Documentation markdown content"
                    spellCheck
                  />
                  <div className={styles.summaryRow}>
                    <input
                      className={styles.summaryInput}
                      type="text"
                      placeholder="Change summary (optional)"
                      value={changeSummary}
                      onChange={(e) => setChangeSummary(e.target.value)}
                      disabled={saving}
                      maxLength={200}
                    />
                  </div>
                </div>
                <div className={styles.editorActions}>
                  <button
                    className={styles.cancelBtn}
                    onClick={handleCancel}
                    disabled={saving}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    className={styles.saveBtn}
                    onClick={handleSave}
                    disabled={saving || !content.trim()}
                    type="button"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.docCard}>
                <article className={styles.markdownBody}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                </article>
              </div>
            )}
          </div>

          {/* History panel */}
          {historyOpen && (
            <aside className={styles.historyPanel}>
              <div className={styles.historyPanelHeader}>
                <span className={styles.historyPanelTitle}>Version History</span>
                <button
                  className={styles.historyCloseBtn}
                  onClick={() => setHistoryOpen(false)}
                  type="button"
                  aria-label="Close history"
                >
                  ✕
                </button>
              </div>
              <div className={styles.historyList}>
                {historyLoading ? (
                  <div className={styles.historyEmpty}>Loading…</div>
                ) : history.length === 0 ? (
                  <div className={styles.historyEmpty}>No versions saved yet.</div>
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
                        {v.change_summary && (
                          <div className={styles.historySummary}>{v.change_summary}</div>
                        )}
                        <div className={styles.historyAuthor}>
                          {v.author_name || v.author_email} · {formatDate(v.created_at)}
                        </div>
                      </div>
                      {canEdit && v.is_current !== 1 && (
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
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

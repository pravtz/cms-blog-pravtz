'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import type { EditorView } from '@codemirror/view'
import { keymap } from '@codemirror/view'
import { EditorToolbar } from './EditorToolbar'
import { MDXPreview } from './MDXPreview'
import { FrontmatterDrawer, type FrontmatterData } from './FrontmatterDrawer'
import {
  ghostTextExtension,
  ghostTextField,
  setGhostText,
  acceptGhostText,
  acceptGhostWord,
  dismissGhostText,
} from './ghostText'
import styles from './MDXEditor.module.css'

export interface PostData {
  id?: string
  content: string
  frontmatter: FrontmatterData
  status?: 'draft' | 'published' | 'scheduled'
}

interface MDXEditorProps {
  initialData?: Partial<PostData>
  onSave?: (data: PostData, options?: { createSnapshot?: boolean }) => Promise<{ id: string } | undefined>
}

type ViewMode = 'split' | 'editor' | 'preview'
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface AiStatus {
  aiEnabled: boolean
  providerActive: boolean
  monthlyTokens: number
  tokensUsed: number
}

const DEFAULT_FRONTMATTER: FrontmatterData = {
  title: '',
  subtitle: '',
  excerpt: '',
  category_id: null,
  tag_ids: [],
  group_ids: [],
  list_ids: [],
  publish_date: '',
  language: 'pt-BR',
  visibility: 'public',
  cover_image: '',
  translation_link: '',
  linked_post_id: null,
  linked_post_title: '',
  seo_title: '',
  seo_description: '',
}

export function MDXEditor({ initialData, onSave }: MDXEditorProps) {
  const [content, setContent] = useState(initialData?.content ?? '')
  const [frontmatter, setFrontmatter] = useState<FrontmatterData>({
    ...DEFAULT_FRONTMATTER,
    ...initialData?.frontmatter,
  })
  const [postId, setPostId] = useState<string | undefined>(initialData?.id)
  const [postStatus, setPostStatus] = useState<'draft' | 'published' | 'scheduled'>(
    initialData?.status ?? 'draft'
  )
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isDirty, setIsDirty] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // AI state
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null)
  const [aiBadgePulse, setAiBadgePulse] = useState(false)
  const aiEnabled = aiStatus?.aiEnabled && aiStatus?.providerActive

  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const viewRef = useRef<EditorView | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSavedRef = useRef<string>(JSON.stringify({ content, frontmatter }))
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  const frontmatterRef = useRef(frontmatter)

  // Keep refs in sync
  useEffect(() => { contentRef.current = content }, [content])
  useEffect(() => { frontmatterRef.current = frontmatter }, [frontmatter])

  // Keep viewRef in sync with CodeMirror view
  const handleEditorCreated = useCallback((view: EditorView) => {
    viewRef.current = view
  }, [])

  const getCurrentData = useCallback(
    (): PostData => ({
      id: postId,
      content,
      frontmatter,
      status: postStatus,
    }),
    [postId, content, frontmatter, postStatus]
  )

  const save = useCallback(
    async (data: PostData, options?: { createSnapshot?: boolean }) => {
      if (!onSave) return
      setSaveStatus('saving')
      try {
        const result = await onSave(data, options)
        if (result?.id && !postId) {
          setPostId(result.id)
          // Update URL without reload
          window.history.replaceState({}, '', `/admin/posts/${result.id}/edit`)
        }
        lastSavedRef.current = JSON.stringify({ content: data.content, frontmatter: data.frontmatter })
        setSaveStatus('saved')
        setIsDirty(false)
      } catch {
        setSaveStatus('error')
      }
    },
    [onSave, postId]
  )

  // Ctrl+S manual save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save(getCurrentData(), { createSnapshot: true })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save, getCurrentData])

  // Auto-save every 30s when dirty
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      const current = JSON.stringify({ content, frontmatter })
      if (current !== lastSavedRef.current) {
        save(getCurrentData())
      }
    }, 30_000)
    return () => {
      if (autoSaveTimer.current) clearInterval(autoSaveTimer.current)
    }
  }, [content, frontmatter, save, getCurrentData])

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Fetch AI status on mount
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) return

    fetch('/api/admin/ai/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data: AiStatus | null) => {
        if (data) setAiStatus(data)
      })
      .catch(() => {/* silently ignore */})
  }, [])

  // Trigger AI autocomplete after 1.5s pause in typing
  const triggerAiComplete = useCallback(async (currentContent: string) => {
    if (!aiEnabled) return
    const view = viewRef.current
    if (!view) return

    const cursor = view.state.selection.main.head
    const token = localStorage.getItem('accessToken')
    if (!token) return

    try {
      const res = await fetch('/api/admin/ai/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          context: currentContent,
          title: frontmatterRef.current.title,
          language: frontmatterRef.current.language,
        }),
      })

      if (!res.ok) return

      const data = await res.json() as {
        suggestion: string
        totalUsedToday: number
        monthlyLimit: number
      }

      if (!data.suggestion) return

      // Update AI status badge
      setAiStatus((prev) =>
        prev ? { ...prev, tokensUsed: data.totalUsedToday } : prev
      )
      setAiBadgePulse(true)
      setTimeout(() => setAiBadgePulse(false), 500)

      // Check cursor hasn't moved since we sent the request
      const currentCursor = view.state.selection.main.head
      if (currentCursor !== cursor) return

      // Set ghost text at cursor position
      view.dispatch({
        effects: setGhostText.of({ text: data.suggestion, pos: cursor }),
      })
    } catch {
      // Silently ignore AI errors
    }
  }, [aiEnabled])

  const handleContentChange = (value: string) => {
    setContent(value)
    setIsDirty(true)
    setSaveStatus('unsaved')

    // Clear existing AI timer; dismiss ghost text on typing
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    if (viewRef.current) {
      const ghost = viewRef.current.state.field(ghostTextField, false)
      if (ghost) {
        dismissGhostText(viewRef.current)
      }
    }

    if (aiEnabled) {
      aiTimerRef.current = setTimeout(() => {
        triggerAiComplete(value)
      }, 1500)
    }
  }

  const handleFrontmatterChange = (partial: Partial<FrontmatterData>) => {
    setFrontmatter((prev) => ({ ...prev, ...partial }))
    setIsDirty(true)
    setSaveStatus('unsaved')
  }

  const handleManualSave = () => {
    save(getCurrentData(), { createSnapshot: true })
  }

  const handlePublish = async () => {
    if (!onSave) return
    const isFuture =
      frontmatter.publish_date !== '' &&
      new Date(frontmatter.publish_date).getTime() > Date.now()
    const newStatus: 'published' | 'scheduled' = isFuture ? 'scheduled' : 'published'
    setPublishing(true)
    try {
      const data: PostData = { id: postId, content, frontmatter, status: newStatus }
      await onSave(data, { createSnapshot: true })
      setPostStatus(newStatus)
      lastSavedRef.current = JSON.stringify({ content, frontmatter })
      setSaveStatus('saved')
      setIsDirty(false)
    } catch {
      setSaveStatus('error')
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    if (!onSave) return
    setPublishing(true)
    try {
      const data: PostData = { id: postId, content, frontmatter, status: 'draft' }
      await onSave(data)
      setPostStatus('draft')
    } catch {
      setSaveStatus('error')
    } finally {
      setPublishing(false)
    }
  }

  const saveStatusLabel: Record<SaveStatus, string> = {
    saved: 'Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  }

  // CodeMirror keybindings for ghost text
  const ghostKeymap = keymap.of([
    {
      key: 'Tab',
      run(view) {
        return acceptGhostText(view)
      },
    },
    {
      key: 'ArrowRight',
      run(view) {
        return acceptGhostWord(view)
      },
    },
    {
      key: 'Escape',
      run(view) {
        return dismissGhostText(view)
      },
    },
  ])

  const aiBadgeLabel = aiEnabled && aiStatus
    ? `AI Active — ${aiStatus.tokensUsed.toLocaleString()}/${aiStatus.monthlyTokens.toLocaleString()} tokens`
    : null

  return (
    <div className={styles.editorRoot}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <input
            className={styles.titleInput}
            value={frontmatter.title}
            onChange={(e) =>
              handleFrontmatterChange({ title: e.target.value })
            }
            placeholder="Post title…"
            aria-label="Post title"
          />
        </div>

        <div className={styles.controls}>
          <span
            className={`${styles.saveStatus} ${styles[saveStatus]}`}
            aria-live="polite"
            aria-atomic="true"
          >
            {saveStatusLabel[saveStatus]}
          </span>

          {/* AI token usage badge */}
          {aiBadgeLabel && (
            <span
              className={`${styles.aiBadge} ${styles.aiBadgeActive} ${aiBadgePulse ? styles.aiBadgePulse : ''}`}
              title="AI autocomplete is active. Tab=accept, →=word, Esc=dismiss"
              aria-live="polite"
              aria-atomic="true"
            >
              {aiBadgeLabel}
            </span>
          )}

          {/* View mode toggle */}
          <div className={styles.viewToggle} role="group" aria-label="Editor view mode">
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'editor' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('editor')}
              aria-pressed={viewMode === 'editor'}
            >
              Editor
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'split' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('split')}
              aria-pressed={viewMode === 'split'}
            >
              Split
            </button>
            <button
              type="button"
              className={`${styles.viewBtn} ${viewMode === 'preview' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('preview')}
              aria-pressed={viewMode === 'preview'}
            >
              Preview
            </button>
          </div>

          <button
            type="button"
            className={styles.saveBtn}
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
          >
            Save
          </button>

          {postStatus === 'published' || postStatus === 'scheduled' ? (
            <button
              type="button"
              className={`${styles.saveBtn} ${styles.unpublishBtn}`}
              onClick={handleUnpublish}
              disabled={publishing}
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.saveBtn} ${styles.publishBtn}`}
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing
                ? 'Publishing…'
                : frontmatter.publish_date !== '' &&
                  new Date(frontmatter.publish_date).getTime() > Date.now()
                ? 'Schedule'
                : 'Publish'}
            </button>
          )}

          {postId && (
            <Link
              href={`/admin/posts/${postId}/versions`}
              className={styles.historyLink}
              title="View version history"
            >
              History
            </Link>
          )}
        </div>
      </div>

      {/* Toolbar — only shown when editor is visible */}
      {viewMode !== 'preview' && (
        <EditorToolbar
          viewRef={viewRef}
          onOpenFrontmatter={() => setDrawerOpen(true)}
        />
      )}

      {/* Body */}
      <div
        className={`${styles.body} ${
          viewMode === 'split'
            ? styles.split
            : viewMode === 'editor'
            ? styles.editorOnly
            : styles.previewOnly
        }`}
      >
        {viewMode !== 'preview' && (
          <div className={styles.editorPane}>
            <CodeMirror
              ref={editorRef}
              value={content}
              height="100%"
              extensions={[markdown(), ghostTextExtension(), ghostKeymap]}
              theme={oneDark}
              onChange={handleContentChange}
              onCreateEditor={handleEditorCreated}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: false,
                highlightSelectionMatches: true,
              }}
              className={styles.codeMirror}
            />
          </div>
        )}

        {viewMode !== 'editor' && (
          <div className={styles.previewPane}>
            <MDXPreview content={content} />
          </div>
        )}
      </div>

      {/* Frontmatter Drawer */}
      <FrontmatterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        data={frontmatter}
        onChange={handleFrontmatterChange}
      />
    </div>
  )
}

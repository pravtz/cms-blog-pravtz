'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import type { EditorView } from '@codemirror/view'
import { EditorToolbar } from './EditorToolbar'
import { MDXPreview } from './MDXPreview'
import { FrontmatterDrawer, type FrontmatterData } from './FrontmatterDrawer'
import styles from './MDXEditor.module.css'

export interface PostData {
  id?: string
  content: string
  frontmatter: FrontmatterData
}

interface MDXEditorProps {
  initialData?: Partial<PostData>
  onSave?: (data: PostData) => Promise<{ id: string } | undefined>
}

type ViewMode = 'split' | 'editor' | 'preview'
type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

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
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [isDirty, setIsDirty] = useState(false)

  const editorRef = useRef<ReactCodeMirrorRef>(null)
  const viewRef = useRef<EditorView | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastSavedRef = useRef<string>(JSON.stringify({ content, frontmatter }))

  // Keep viewRef in sync with CodeMirror view
  const handleEditorCreated = useCallback((view: EditorView) => {
    viewRef.current = view
  }, [])

  const getCurrentData = useCallback(
    (): PostData => ({
      id: postId,
      content,
      frontmatter,
    }),
    [postId, content, frontmatter]
  )

  const save = useCallback(
    async (data: PostData) => {
      if (!onSave) return
      setSaveStatus('saving')
      try {
        const result = await onSave(data)
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
        save(getCurrentData())
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

  const handleContentChange = (value: string) => {
    setContent(value)
    setIsDirty(true)
    setSaveStatus('unsaved')
  }

  const handleFrontmatterChange = (partial: Partial<FrontmatterData>) => {
    setFrontmatter((prev) => ({ ...prev, ...partial }))
    setIsDirty(true)
    setSaveStatus('unsaved')
  }

  const handleManualSave = () => {
    save(getCurrentData())
  }

  const saveStatusLabel: Record<SaveStatus, string> = {
    saved: 'Saved',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  }

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
              extensions={[markdown()]}
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

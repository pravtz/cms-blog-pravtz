'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import styles from './page.module.css'
import type { CardData, FormatKey } from './SocialCardCanvas'
import { FORMATS } from './SocialCardCanvas'

const SocialCardCanvas = dynamic(() => import('./SocialCardCanvas'), { ssr: false })

interface Post {
  id: string
  title: string
  subtitle: string | null
  cover_image: string | null
  author_name: string
}

type InputMode = 'post' | 'manual'

const FORMAT_ICONS: Record<FormatKey, { w: number; h: number }> = {
  instagram: { w: 40, h: 40 },
  stories: { w: 28, h: 50 },
  linkedin: { w: 50, h: 26 },
  twitter: { w: 50, h: 25 },
}

function FormatIcon({ format }: { format: FormatKey }) {
  const { w, h } = FORMAT_ICONS[format]
  return (
    <svg
      width={w}
      height={h}
      className={styles.formatIcon}
      aria-hidden="true"
    >
      <rect x="0" y="0" width={w} height={h} rx="3" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

export default function SocialCardsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [mode, setMode] = useState<InputMode>('post')
  const [format, setFormat] = useState<FormatKey>('instagram')

  // Post search
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Post[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)

  // Card fields
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [author, setAuthor] = useState('')
  const [backgroundImage, setBackgroundImage] = useState('')
  const [logoImage, setLogoImage] = useState('')

  const cardData: CardData = {
    title: title || 'Your Post Title',
    subtitle,
    author,
    backgroundImage,
    logoImage,
    format,
  }

  // Populate fields from selected post
  useEffect(() => {
    if (mode === 'post' && selectedPost) {
      setTitle(selectedPost.title)
      setSubtitle(selectedPost.subtitle ?? '')
      setAuthor(selectedPost.author_name)
      setBackgroundImage(selectedPost.cover_image ?? '')
    }
  }, [selectedPost, mode])

  // Reset fields on mode change
  useEffect(() => {
    if (mode === 'manual') {
      setSelectedPost(null)
      setTitle('')
      setSubtitle('')
      setAuthor('')
      setBackgroundImage('')
    }
  }, [mode])

  // Debounced post search
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    setSearchLoading(true)
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : ''
      const res = await fetch(`/api/posts?search=${encodeURIComponent(q)}&limit=8`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.posts ?? [])
        setShowDropdown(true)
      }
    } catch {
      // ignore
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => doSearch(e.target.value), 300)
  }

  const handleSelectPost = (post: Post) => {
    setSelectedPost(post)
    setSearch('')
    setShowDropdown(false)
  }

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fmt = FORMATS[format]
    const link = document.createElement('a')
    link.download = `social-card-${format}-${Date.now()}.png`
    link.href = canvas.toDataURL('image/png', 1.0)
    link.click()
  }

  const currentFormat = FORMATS[format]

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Social Cards Generator</h1>
        <p>Create high-res social media cards from your posts. Export as PNG for Instagram, Stories, LinkedIn, and Twitter/X.</p>
      </div>

      <div className={styles.layout}>
        {/* Controls */}
        <aside className={styles.controls}>
          {/* Format */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Format</h2>
            <div className={styles.formatGrid} role="radiogroup" aria-label="Card format">
              {(Object.keys(FORMATS) as FormatKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={format === key}
                  className={`${styles.formatBtn} ${format === key ? styles.active : ''}`}
                  onClick={() => setFormat(key)}
                >
                  <FormatIcon format={key} />
                  <span className={styles.formatLabel}>{FORMATS[key].label}</span>
                  <span className={styles.formatDims}>{FORMATS[key].width} × {FORMATS[key].height}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Input mode */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Content Source</h2>
            <div className={styles.modeToggle} role="tablist">
              <button
                role="tab"
                aria-selected={mode === 'post'}
                className={`${styles.modeBtn} ${mode === 'post' ? styles.active : ''}`}
                onClick={() => setMode('post')}
              >
                From Post
              </button>
              <button
                role="tab"
                aria-selected={mode === 'manual'}
                className={`${styles.modeBtn} ${mode === 'manual' ? styles.active : ''}`}
                onClick={() => setMode('manual')}
              >
                Manual Entry
              </button>
            </div>
          </div>

          {/* Post search */}
          {mode === 'post' && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Select Post</h2>
              {selectedPost ? (
                <div className={styles.selectedPost}>
                  <span className={styles.selectedPostTitle}>{selectedPost.title}</span>
                  <button
                    type="button"
                    className={styles.clearBtn}
                    onClick={() => setSelectedPost(null)}
                    aria-label="Clear selected post"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className={styles.postSearch}>
                  <input
                    type="search"
                    className={styles.postSearchInput}
                    placeholder={searchLoading ? 'Searching…' : 'Search posts by title…'}
                    value={search}
                    onChange={handleSearchChange}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                    aria-label="Search posts"
                    aria-autocomplete="list"
                  />
                  {showDropdown && searchResults.length > 0 && (
                    <ul className={styles.postDropdown} role="listbox">
                      {searchResults.map((post) => (
                        <li
                          key={post.id}
                          className={styles.postOption}
                          role="option"
                          aria-selected={false}
                          onMouseDown={() => handleSelectPost(post)}
                        >
                          <div className={styles.postOptionTitle}>{post.title}</div>
                          <div className={styles.postOptionMeta}>{post.author_name}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Editable fields */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Card Fields</h2>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="card-title">Title</label>
              <textarea
                id="card-title"
                className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Post title…"
                rows={2}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="card-subtitle">Subtitle</label>
              <textarea
                id="card-subtitle"
                className={`${styles.fieldInput} ${styles.fieldTextarea}`}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Optional subtitle or excerpt…"
                rows={2}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="card-author">Author</label>
              <input
                id="card-author"
                type="text"
                className={styles.fieldInput}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name…"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="card-bg">Background Image URL</label>
              <input
                id="card-bg"
                type="url"
                className={styles.fieldInput}
                value={backgroundImage}
                onChange={(e) => setBackgroundImage(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="card-logo">Logo Image URL</label>
              <input
                id="card-logo"
                type="url"
                className={styles.fieldInput}
                value={logoImage}
                onChange={(e) => setLogoImage(e.target.value)}
                placeholder="https://… (optional)"
              />
            </div>
          </div>
        </aside>

        {/* Preview */}
        <section className={styles.preview}>
          <div className={styles.previewHeader}>
            <h2 className={styles.previewTitle}>Preview</h2>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={handleExport}
              aria-label={`Export ${currentFormat.label} as PNG`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export PNG
            </button>
          </div>

          <div className={styles.formatInfo}>
            <span className={styles.formatInfoBadge}>{currentFormat.label}</span>
            <span>{currentFormat.width} × {currentFormat.height} px</span>
            <span>High-res PNG</span>
          </div>

          <div className={styles.canvasWrapper}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              aria-label={`Social card preview: ${currentFormat.label}`}
            />
          </div>

          <SocialCardCanvas data={cardData} canvasRef={canvasRef} />
        </section>
      </div>
    </div>
  )
}

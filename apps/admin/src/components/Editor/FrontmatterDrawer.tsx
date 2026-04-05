'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './FrontmatterDrawer.module.css'

export interface FrontmatterData {
  title: string
  subtitle: string
  excerpt: string
  category_id: string | null
  tag_ids: string[]
  publish_date: string
  language: string
  visibility: 'public' | 'allPrivate' | 'groupPrivate' | 'listPrivate' | 'iPrivate'
  cover_image: string
  translation_link: string
  seo_title: string
  seo_description: string
}

interface Category {
  id: string
  name: string
  slug: string
}

interface Tag {
  id: string
  name: string
  slug: string
}

interface FrontmatterDrawerProps {
  open: boolean
  onClose: () => void
  data: FrontmatterData
  onChange: (data: Partial<FrontmatterData>) => void
}

export function FrontmatterDrawer({
  open,
  onClose,
  data,
  onChange,
}: FrontmatterDrawerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [newCategory, setNewCategory] = useState('')
  const [newTag, setNewTag] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
    fetch('/api/tags')
      .then((r) => r.json())
      .then((d) => setTags(d.tags ?? []))
  }, [open])

  // Focus trap
  useEffect(() => {
    if (open) {
      closeRef.current?.focus()
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  const createCategory = async () => {
    if (!newCategory.trim()) return
    setCreatingCat(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategory.trim() }),
      })
      if (res.ok) {
        const { category } = await res.json()
        setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)))
        onChange({ category_id: category.id })
        setNewCategory('')
      }
    } finally {
      setCreatingCat(false)
    }
  }

  const createTag = async () => {
    if (!newTag.trim()) return
    setCreatingTag(true)
    try {
      const res = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTag.trim() }),
      })
      if (res.ok) {
        const { tag } = await res.json()
        setTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
        onChange({ tag_ids: [...data.tag_ids, tag.id] })
        setNewTag('')
      }
    } finally {
      setCreatingTag(false)
    }
  }

  const toggleTag = (id: string) => {
    const ids = data.tag_ids.includes(id)
      ? data.tag_ids.filter((t) => t !== id)
      : [...data.tag_ids, id]
    onChange({ tag_ids: ids })
  }

  // SEO preview character counts
  const seoTitle = data.seo_title || data.title
  const seoDesc = data.seo_description || data.excerpt

  if (!open) return null

  return (
    <>
      <div
        className={styles.overlay}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Post settings"
      >
        <div className={styles.header}>
          <h2 className={styles.title}>Post Settings</h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* Title */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-title">Title</label>
            <input
              id="fm-title"
              className={styles.input}
              value={data.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Post title"
            />
          </div>

          {/* Subtitle */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-subtitle">Subtitle</label>
            <input
              id="fm-subtitle"
              className={styles.input}
              value={data.subtitle}
              onChange={(e) => onChange({ subtitle: e.target.value })}
              placeholder="Optional subtitle"
            />
          </div>

          {/* Excerpt */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-excerpt">Excerpt</label>
            <textarea
              id="fm-excerpt"
              className={styles.textarea}
              value={data.excerpt}
              onChange={(e) => onChange({ excerpt: e.target.value })}
              placeholder="Short summary shown in post lists"
              rows={3}
            />
          </div>

          {/* Category */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-category">Category</label>
            <select
              id="fm-category"
              className={styles.select}
              value={data.category_id ?? ''}
              onChange={(e) => onChange({ category_id: e.target.value || null })}
            >
              <option value="">— No category —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className={styles.inlineCreate}>
              <input
                className={styles.inputSm}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createCategory()}
                placeholder="New category…"
              />
              <button
                type="button"
                className={styles.addBtn}
                onClick={createCategory}
                disabled={creatingCat || !newCategory.trim()}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Tags */}
          <div className={styles.field}>
            <label className={styles.label}>Tags</label>
            <div className={styles.tagCloud}>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.tagChip} ${data.tag_ids.includes(t.id) ? styles.tagActive : ''}`}
                  onClick={() => toggleTag(t.id)}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <div className={styles.inlineCreate}>
              <input
                className={styles.inputSm}
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createTag()}
                placeholder="New tag…"
              />
              <button
                type="button"
                className={styles.addBtn}
                onClick={createTag}
                disabled={creatingTag || !newTag.trim()}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Publish date */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-date">Publish date</label>
            <input
              id="fm-date"
              type="datetime-local"
              className={styles.input}
              value={data.publish_date}
              onChange={(e) => onChange({ publish_date: e.target.value })}
            />
          </div>

          {/* Language */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-lang">Language</label>
            <select
              id="fm-lang"
              className={styles.select}
              value={data.language}
              onChange={(e) => onChange({ language: e.target.value })}
            >
              <option value="pt-BR">Português (pt-BR)</option>
              <option value="en">English (en)</option>
            </select>
          </div>

          {/* Visibility */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-visibility">Visibility</label>
            <select
              id="fm-visibility"
              className={styles.select}
              value={data.visibility}
              onChange={(e) =>
                onChange({
                  visibility: e.target.value as FrontmatterData['visibility'],
                })
              }
            >
              <option value="public">Public</option>
              <option value="allPrivate">All members only</option>
              <option value="groupPrivate">Group members only</option>
              <option value="listPrivate">List members only</option>
              <option value="iPrivate">Only me (author)</option>
            </select>
          </div>

          {/* Cover image */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-cover">Cover image URL</label>
            <input
              id="fm-cover"
              className={styles.input}
              value={data.cover_image}
              onChange={(e) => onChange({ cover_image: e.target.value })}
              placeholder="https://…"
            />
          </div>

          {/* Translation link */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fm-translation">Translation link (post ID)</label>
            <input
              id="fm-translation"
              className={styles.input}
              value={data.translation_link}
              onChange={(e) => onChange({ translation_link: e.target.value })}
              placeholder="Post ID of the translation"
            />
          </div>

          {/* SEO section */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>SEO</h3>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fm-seo-title">
                SEO title{' '}
                <span className={`${styles.charCount} ${seoTitle.length > 60 ? styles.charOver : ''}`}>
                  {seoTitle.length}/60
                </span>
              </label>
              <input
                id="fm-seo-title"
                className={styles.input}
                value={data.seo_title}
                onChange={(e) => onChange({ seo_title: e.target.value })}
                placeholder="Defaults to post title"
                maxLength={200}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="fm-seo-desc">
                SEO description{' '}
                <span className={`${styles.charCount} ${seoDesc.length > 160 ? styles.charOver : ''}`}>
                  {seoDesc.length}/160
                </span>
              </label>
              <textarea
                id="fm-seo-desc"
                className={styles.textarea}
                value={data.seo_description}
                onChange={(e) => onChange({ seo_description: e.target.value })}
                placeholder="Defaults to excerpt"
                rows={3}
                maxLength={500}
              />
            </div>

            {/* SEO Preview snippet */}
            <div className={styles.seoPreview}>
              <div className={styles.seoUrl}>https://yourblog.com/blog/your-post-slug</div>
              <div className={styles.seoTitle}>{seoTitle || 'Post title'}</div>
              <div className={styles.seoDesc}>{seoDesc || 'Post description will appear here.'}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

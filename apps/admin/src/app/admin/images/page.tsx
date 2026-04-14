'use client'

import { useCallback, useEffect, useState } from 'react'
import styles from './page.module.css'
import { AIImageGenerator, type SavedImage } from '@/components/AIImageGenerator'
import { useToast } from '@/components'

interface ImageItem {
  id: string
  url: string
  altText: string
  aiGenerated: boolean
  prompt: string | null
  style: string | null
  aspectRatio: string | null
  createdByName: string
  createdAt: string
}

export default function ImagesPage() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [aiOnly, setAiOnly] = useState(false)
  const [generatorOpen, setGeneratorOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const { toast } = useToast()

  const fetchImages = useCallback(async (p: number, ai: boolean) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      const params = new URLSearchParams({ page: String(p) })
      if (ai) params.set('aiOnly', 'true')

      const res = await fetch(`/api/admin/images?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        toast({ variant: 'error', title: 'Failed to load images' })
        return
      }

      const data = await res.json() as {
        images: ImageItem[]
        total: number
        page: number
        totalPages: number
      }
      setImages(data.images)
      setTotal(data.total)
      setTotalPages(data.totalPages)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchImages(page, aiOnly)
  }, [fetchImages, page, aiOnly])

  const handleFilterChange = (ai: boolean) => {
    setAiOnly(ai)
    setPage(1)
  }

  const handleImageSaved = (image: SavedImage) => {
    toast({ variant: 'success', title: 'Image saved to library' })
    fetchImages(1, aiOnly)
    setPage(1)
  }

  const handleCopyUrl = async (image: ImageItem) => {
    try {
      await navigator.clipboard.writeText(image.url)
      setCopiedId(image.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      toast({ variant: 'error', title: 'Failed to copy URL' })
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return iso
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Image Library
          {total > 0 && (
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              ({total})
            </span>
          )}
        </h1>
        <div className={styles.headerRight}>
          <div className={styles.filterBar}>
            <button
              type="button"
              className={`${styles.filterBtn} ${!aiOnly ? styles.filterBtnActive : ''}`}
              onClick={() => handleFilterChange(false)}
            >
              All Images
            </button>
            <button
              type="button"
              className={`${styles.filterBtn} ${aiOnly ? styles.filterBtnActive : ''}`}
              onClick={() => handleFilterChange(true)}
            >
              ✨ AI Generated
            </button>
          </div>
          <button
            type="button"
            className={styles.generateBtn}
            onClick={() => setGeneratorOpen(true)}
          >
            ✨ Generate with AI
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {loading ? (
          <div className={styles.loading}>Loading images…</div>
        ) : images.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>🖼</span>
            <p className={styles.emptyText}>
              {aiOnly
                ? 'No AI-generated images yet. Click "Generate with AI" to create some!'
                : 'No images yet. Use the AI Image Generator to get started!'}
            </p>
            <button
              type="button"
              className={styles.generateBtn}
              onClick={() => setGeneratorOpen(true)}
            >
              ✨ Generate with AI
            </button>
          </div>
        ) : (
          images.map((img) => (
            <div key={img.id} className={styles.card}>
              <div className={styles.imageWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.altText || 'Library image'} />
                {img.aiGenerated && (
                  <span className={styles.aiBadge} aria-label="AI generated">AI</span>
                )}
              </div>
              <div className={styles.cardBody}>
                <p className={styles.altText} title={img.altText || '(no alt text)'}>
                  {img.altText || <em style={{ color: 'var(--text-muted)' }}>No alt text</em>}
                </p>
                {img.prompt && (
                  <p className={styles.meta} title={img.prompt}>
                    Prompt: {img.prompt}
                  </p>
                )}
                <p className={styles.meta}>
                  {img.createdByName} · {formatDate(img.createdAt)}
                </p>
              </div>
              <div className={styles.cardActions}>
                <button
                  type="button"
                  className={styles.copyBtn}
                  onClick={() => handleCopyUrl(img)}
                  title="Copy image URL to clipboard"
                >
                  {copiedId === img.id ? '✓ Copied!' : '⎘ Copy URL'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next →
          </button>
        </div>
      )}

      <AIImageGenerator
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onImageSaved={handleImageSaved}
        mode="library"
      />
    </div>
  )
}

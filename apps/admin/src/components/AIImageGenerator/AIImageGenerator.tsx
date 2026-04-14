'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import styles from './AIImageGenerator.module.css'

export interface SavedImage {
  id: string
  url: string
  altText: string
  aiGenerated: boolean
  prompt: string | null
  style: string | null
  aspectRatio: string | null
}

interface AIImageGeneratorProps {
  open: boolean
  onClose: () => void
  /** Called when the user saves an image to the library */
  onImageSaved?: (image: SavedImage) => void
  /** Called when the user inserts the image into the editor */
  onInsertImage?: (url: string, altText: string) => void
  /** Whether to show insert-into-editor button instead of just "Save to Library" */
  mode?: 'library' | 'editor'
}

type Step = 'form' | 'generating' | 'select' | 'crop' | 'save'
type AspectRatio = '1:1' | '16:9' | '9:16'
type Style = 'Photographic' | 'Illustration' | 'Abstract'

interface CropState {
  startX: number
  startY: number
  endX: number
  endY: number
  dragging: boolean
}

const ASPECT_RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16']
const STYLES: Style[] = ['Photographic', 'Illustration', 'Abstract']

export function AIImageGenerator({
  open,
  onClose,
  onImageSaved,
  onInsertImage,
  mode = 'library',
}: AIImageGeneratorProps) {
  const [step, setStep] = useState<Step>('form')
  const [prompt, setPrompt] = useState('')
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1')
  const [style, setStyle] = useState<Style | ''>('')
  const [generatedImages, setGeneratedImages] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [altText, setAltText] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [tokenInfo, setTokenInfo] = useState<{ used: number; limit: number } | null>(null)

  // Crop state
  const [crop, setCrop] = useState<CropState | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const cropContainerRef = useRef<HTMLDivElement>(null)

  const modalRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Focus management
  useEffect(() => {
    if (open) {
      setTimeout(() => closeRef.current?.focus(), 50)
      setStep('form')
      setError('')
      setGeneratedImages([])
      setSelectedIndex(null)
      setCrop(null)
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setStep('generating')
    setError('')

    const token = localStorage.getItem('accessToken')
    try {
      const res = await fetch('/api/admin/ai/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: prompt.trim(), aspectRatio, style: style || undefined }),
      })

      const data = await res.json() as {
        images?: string[]
        altTextSuggestion?: string
        tokensCharged?: number
        totalUsed?: number
        monthlyLimit?: number
        error?: string
      }

      if (!res.ok || !data.images?.length) {
        setError(data.error ?? 'Image generation failed.')
        setStep('form')
        return
      }

      setGeneratedImages(data.images)
      setAltText(data.altTextSuggestion ?? prompt.trim())
      if (data.totalUsed !== undefined && data.monthlyLimit !== undefined) {
        setTokenInfo({ used: data.totalUsed, limit: data.monthlyLimit })
      }
      setStep('select')
    } catch {
      setError('Failed to connect to AI provider.')
      setStep('form')
    }
  }

  const handleSelectVariation = (index: number) => {
    setSelectedIndex(index)
    setCrop(null)
    setStep('crop')
  }

  // Crop drag handlers
  const getRelativeCoords = (e: React.MouseEvent) => {
    const container = cropContainerRef.current
    const img = imgRef.current
    if (!container || !img) return { x: 0, y: 0 }
    const rect = img.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    return { x, y }
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = getRelativeCoords(e)
    setCrop({ startX: x, startY: y, endX: x, endY: y, dragging: true })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setCrop((prev) => {
      if (!prev?.dragging) return prev
      const { x, y } = getRelativeCoords(e)
      return { ...prev, endX: x, endY: y }
    })
  }, [])

  const handleMouseUp = useCallback(() => {
    setCrop((prev) => {
      if (!prev) return prev
      return { ...prev, dragging: false }
    })
  }, [])

  const cropStyle = crop
    ? {
        left: `${Math.min(crop.startX, crop.endX) * 100}%`,
        top: `${Math.min(crop.startY, crop.endY) * 100}%`,
        width: `${Math.abs(crop.endX - crop.startX) * 100}%`,
        height: `${Math.abs(crop.endY - crop.startY) * 100}%`,
      }
    : null

  const hasCrop =
    crop !== null &&
    !crop.dragging &&
    Math.abs(crop.endX - crop.startX) > 0.01 &&
    Math.abs(crop.endY - crop.startY) > 0.01

  const applyCropToCanvas = async (imageUrl: string): Promise<string> => {
    if (!crop || !hasCrop) return imageUrl

    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const minX = Math.min(crop.startX, crop.endX)
        const minY = Math.min(crop.startY, crop.endY)
        const w = Math.abs(crop.endX - crop.startX)
        const h = Math.abs(crop.endY - crop.startY)
        canvas.width = Math.round(img.width * w)
        canvas.height = Math.round(img.height * h)
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(
          img,
          img.width * minX,
          img.height * minY,
          img.width * w,
          img.height * h,
          0,
          0,
          canvas.width,
          canvas.height
        )
        resolve(canvas.toDataURL('image/png'))
      }
      img.onerror = () => resolve(imageUrl)
      img.src = imageUrl
    })
  }

  const handleSave = async () => {
    if (selectedIndex === null) return
    setSaving(true)
    setError('')

    try {
      const originalUrl = generatedImages[selectedIndex]
      const finalUrl = hasCrop ? await applyCropToCanvas(originalUrl) : originalUrl

      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/admin/images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: finalUrl,
          altText,
          aiGenerated: true,
          prompt,
          style: style || null,
          aspectRatio,
        }),
      })

      if (!res.ok) {
        const d = await res.json() as { error?: string }
        setError(d.error ?? 'Failed to save image.')
        return
      }

      const saved = await res.json() as SavedImage

      if (onInsertImage && mode === 'editor') {
        onInsertImage(saved.url, saved.altText)
      }
      if (onImageSaved) {
        onImageSaved(saved)
      }
      onClose()
    } catch {
      setError('Failed to save image.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const selectedImageUrl = selectedIndex !== null ? generatedImages[selectedIndex] : null

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-image-gen-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.modal} ref={modalRef}>
        <div className={styles.header}>
          <h2 id="ai-image-gen-title">AI Image Generator</h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close AI Image Generator"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* Error */}
          {error && <div className={styles.errorMsg} role="alert">{error}</div>}

          {/* STEP: Form */}
          {(step === 'form' || step === 'generating') && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-img-prompt">
                  Describe the image
                </label>
                <textarea
                  id="ai-img-prompt"
                  className={styles.promptInput}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. A minimalist office desk with a laptop, coffee, and plants in morning light"
                  disabled={step === 'generating'}
                />
              </div>

              <div className={styles.row}>
                <div className={styles.formGroup}>
                  <span className={styles.label}>Aspect Ratio</span>
                  <div className={styles.segmentedControl}>
                    {ASPECT_RATIOS.map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        className={`${styles.segBtn} ${aspectRatio === ar ? styles.segBtnActive : ''}`}
                        onClick={() => setAspectRatio(ar)}
                        disabled={step === 'generating'}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <span className={styles.label}>Style (optional)</span>
                  <div className={styles.segmentedControl}>
                    {STYLES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`${styles.segBtn} ${style === s ? styles.segBtnActive : ''}`}
                        onClick={() => setStyle((prev) => prev === s ? '' : s)}
                        disabled={step === 'generating'}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {step === 'generating' ? (
                <div className={styles.loadingSection} aria-live="polite">
                  <div className={styles.spinner} aria-hidden="true" />
                  <span>Generating 4 variations…</span>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.generateBtn}
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                >
                  Generate 4 Variations
                </button>
              )}
            </>
          )}

          {/* STEP: Select variation */}
          {step === 'select' && (
            <>
              <p className={styles.variationsTitle}>
                Select a variation to continue
              </p>
              <div className={styles.variationsGrid}>
                {generatedImages.map((url, i) => (
                  <div
                    key={i}
                    className={`${styles.variationCard} ${selectedIndex === i ? styles.variationCardSelected : ''}`}
                    onClick={() => handleSelectVariation(i)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select variation ${i + 1}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectVariation(i) }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Variation ${i + 1}`} />
                    {selectedIndex === i && (
                      <span className={styles.variationBadge} aria-hidden="true">✓</span>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={styles.generateBtn}
                onClick={() => { setStep('form'); setGeneratedImages([]); setSelectedIndex(null) }}
              >
                ← Generate Again
              </button>
            </>
          )}

          {/* STEP: Crop */}
          {step === 'crop' && selectedImageUrl && (
            <div className={styles.cropSection}>
              <p className={styles.label}>Crop (optional) — drag to select area</p>
              <div
                className={styles.cropContainer}
                ref={cropContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={selectedImageUrl}
                  alt="Selected variation for cropping"
                  draggable={false}
                />
                {cropStyle && (
                  <div
                    className={styles.cropSelection}
                    style={cropStyle}
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className={styles.cropHint}>
                Drag on the image to crop. Leave blank to use the full image.
              </p>
              <div className={styles.cropActions}>
                <button
                  type="button"
                  className={styles.cropResetBtn}
                  onClick={() => setCrop(null)}
                >
                  Reset Crop
                </button>
                <button
                  type="button"
                  className={styles.cropResetBtn}
                  onClick={() => { setStep('select'); setSelectedIndex(null) }}
                >
                  ← Back to Variations
                </button>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="ai-img-alt">
                  Alt Text (editable)
                </label>
                <input
                  id="ai-img-alt"
                  type="text"
                  className={styles.altTextInput}
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  placeholder="Describe the image for accessibility"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            {tokenInfo && (
              <span className={styles.tokenBadge}>
                {tokenInfo.used.toLocaleString()} / {tokenInfo.limit.toLocaleString()} tokens used
              </span>
            )}
          </div>
          <div className={styles.footerRight}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            {step === 'crop' && (
              <button
                type="button"
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving || selectedIndex === null}
              >
                {saving
                  ? 'Saving…'
                  : mode === 'editor'
                  ? 'Save & Insert'
                  : 'Save to Library'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useCallback } from 'react'

export interface CardData {
  title: string
  subtitle: string
  author: string
  backgroundImage: string
  logoImage: string
  format: FormatKey
}

export type FormatKey = 'instagram' | 'stories' | 'linkedin' | 'twitter'

export interface Format {
  label: string
  width: number
  height: number
  aspectRatio: string
}

export const FORMATS: Record<FormatKey, Format> = {
  instagram: { label: 'Instagram 1:1', width: 1080, height: 1080, aspectRatio: '1 / 1' },
  stories: { label: 'Stories 9:16', width: 1080, height: 1920, aspectRatio: '9 / 16' },
  linkedin: { label: 'LinkedIn 1.91:1', width: 1200, height: 627, aspectRatio: '1200 / 627' },
  twitter: { label: 'Twitter/X 2:1', width: 1200, height: 600, aspectRatio: '2 / 1' },
}

interface Props {
  data: CardData
  canvasRef: React.RefObject<HTMLCanvasElement | null>
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  if (!text) return y
  const words = text.split(' ')
  let line = ''
  let currentY = y

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' '
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, currentY)
      line = words[i] + ' '
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line.trim(), x, currentY)
  return currentY + lineHeight
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export default function SocialCardCanvas({ data, canvasRef }: Props) {
  const drawTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const draw = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const format = FORMATS[data.format]
    canvas.width = format.width
    canvas.height = format.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = format.width
    const H = format.height
    const PAD = W * 0.08

    // Background
    ctx.fillStyle = '#0f0f0f'
    ctx.fillRect(0, 0, W, H)

    // Background image
    if (data.backgroundImage) {
      try {
        const img = await loadImage(data.backgroundImage)
        const scale = Math.max(W / img.width, H / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        const dx = (W - dw) / 2
        const dy = (H - dh) / 2
        ctx.drawImage(img, dx, dy, dw, dh)
      } catch {
        // fallback to dark bg already drawn
      }
    }

    // Dark overlay gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, 'rgba(0,0,0,0.25)')
    grad.addColorStop(0.4, 'rgba(0,0,0,0.3)')
    grad.addColorStop(1, 'rgba(0,0,0,0.85)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Logo (top-left)
    if (data.logoImage) {
      try {
        const logo = await loadImage(data.logoImage)
        const maxLogoH = H * 0.06
        const logoScale = maxLogoH / logo.height
        const logoW = logo.width * logoScale
        const logoH = logo.height * logoScale
        ctx.drawImage(logo, PAD, PAD, logoW, logoH)
      } catch {
        // skip if logo fails
      }
    } else {
      // Draw "N" text logo as fallback
      ctx.font = `bold ${H * 0.05}px Inter, system-ui, sans-serif`
      ctx.fillStyle = '#6366f1'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('N', PAD, PAD)
    }

    // Content area - positioned in the lower portion
    const contentTop = H * 0.52
    const maxTextWidth = W - PAD * 2

    // Accent line
    ctx.fillStyle = '#6366f1'
    ctx.fillRect(PAD, contentTop - H * 0.04, W * 0.06, H * 0.006)

    // Title
    const titleSize = data.format === 'stories' ? H * 0.055 : H * 0.07
    ctx.font = `bold ${titleSize}px "Newsreader", Georgia, serif`
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    const titleLineH = titleSize * 1.25
    let y = contentTop
    y = wrapText(ctx, data.title || 'Post Title', PAD, y, maxTextWidth, titleLineH)

    // Subtitle
    if (data.subtitle) {
      y += H * 0.015
      const subtitleSize = data.format === 'stories' ? H * 0.032 : H * 0.04
      ctx.font = `${subtitleSize}px Inter, system-ui, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      y = wrapText(ctx, data.subtitle, PAD, y, maxTextWidth, subtitleSize * 1.4)
    }

    // Author + Nexus branding at bottom
    const bottomY = H - PAD * 0.9
    ctx.textBaseline = 'bottom'

    const authorSize = data.format === 'stories' ? H * 0.028 : H * 0.035
    ctx.font = `${authorSize}px Inter, system-ui, sans-serif`

    if (data.author) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.textAlign = 'left'
      ctx.fillText(data.author, PAD, bottomY)
    }

    // Nexus CMS label right-aligned
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.textAlign = 'right'
    ctx.fillText('Nexus CMS', W - PAD, bottomY)

    // Bottom accent bar
    ctx.fillStyle = '#6366f1'
    ctx.fillRect(0, H - 6, W, 6)
  }, [data, canvasRef])

  useEffect(() => {
    if (drawTimeout.current) clearTimeout(drawTimeout.current)
    drawTimeout.current = setTimeout(draw, 50)
    return () => {
      if (drawTimeout.current) clearTimeout(drawTimeout.current)
    }
  }, [draw])

  return null
}

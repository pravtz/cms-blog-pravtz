'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import styles from './ShareButton.module.css'
import { fetchAdminSession } from '@/lib/fetchAdminSession'
import { getAdminApiBaseUrl } from '@/lib/adminApiBaseUrl'

interface ShareButtonProps {
  postSlug: string
  postTitle: string
  initialShareCount: number
}

export default function ShareButton({ postSlug, postTitle, initialShareCount }: ShareButtonProps) {
  const [shareCount, setShareCount] = useState(initialShareCount)
  const [isOpen, setIsOpen] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [copyTooltip, setCopyTooltip] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      try {
        const session = await fetchAdminSession()
        if (session?.user && session.accessToken) {
          setIsLoggedIn(true)
          setAccessToken(session.accessToken)
        }
        const shareRes = await fetch(
          `${getAdminApiBaseUrl()}/api/blog/posts/${encodeURIComponent(postSlug)}/shares`
        )
        if (shareRes.ok) {
          const shareData = await shareRes.json()
          setShareCount(shareData.shareCount)
        }
      } catch {
        /* ignore */
      }
    }
    init()
  }, [postSlug])

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const registerShare = useCallback(async (channel: string) => {
    if (!isLoggedIn || !accessToken) return
    try {
      const res = await fetch(
        `${getAdminApiBaseUrl()}/api/blog/posts/${encodeURIComponent(postSlug)}/shares`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ channel }),
        }
      )
      if (res.ok) {
        const data = await res.json()
        setShareCount(data.shareCount)
      }
    } catch { /* ignore */ }
  }, [isLoggedIn, accessToken, postSlug])

  const getPostUrl = useCallback(() => {
    if (typeof window !== 'undefined') {
      return window.location.href
    }
    return `${process.env.NEXT_PUBLIC_BLOG_URL ?? ''}/blog/${postSlug}`
  }, [postSlug])

  const handleWhatsApp = useCallback(() => {
    const url = getPostUrl()
    const text = encodeURIComponent(`${postTitle} ${url}`)
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
    registerShare('whatsapp')
    setIsOpen(false)
  }, [postTitle, registerShare, getPostUrl])

  const handleLinkedIn = useCallback(() => {
    const url = encodeURIComponent(getPostUrl())
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      '_blank',
      'noopener,noreferrer'
    )
    registerShare('linkedin')
    setIsOpen(false)
  }, [registerShare, getPostUrl])

  const handleInstagram = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getPostUrl())
      setCopyTooltip('Link copiado! Cole no Instagram.')
      setTimeout(() => setCopyTooltip(''), 3000)
    } catch {
      setCopyTooltip('Não foi possível copiar')
      setTimeout(() => setCopyTooltip(''), 2000)
    }
    registerShare('instagram')
    setIsOpen(false)
  }, [registerShare, getPostUrl])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getPostUrl())
      setCopyTooltip('Link copiado!')
      setTimeout(() => setCopyTooltip(''), 2500)
    } catch {
      setCopyTooltip('Não foi possível copiar')
      setTimeout(() => setCopyTooltip(''), 2000)
    }
    registerShare('clipboard')
    setIsOpen(false)
  }, [registerShare, getPostUrl])

  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      <button
        className={styles.button}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={`Compartilhar (${shareCount} compartilhamentos)`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        type="button"
      >
        <svg
          className={styles.icon}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <span className={styles.count}>{shareCount}</span>
      </button>

      {isOpen && (
        <div className={styles.dropdown} role="menu" aria-label="Opções de compartilhamento">
          <button
            className={styles.option}
            onClick={handleWhatsApp}
            role="menuitem"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.099.543 4.071 1.496 5.786L0 24l6.37-1.471A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.374l-.36-.213-3.781.872.9-3.67-.234-.376A9.818 9.818 0 1112 21.818z" />
            </svg>
            WhatsApp
          </button>

          <button
            className={styles.option}
            onClick={handleLinkedIn}
            role="menuitem"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
            LinkedIn
          </button>

          <button
            className={styles.option}
            onClick={handleInstagram}
            role="menuitem"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
            </svg>
            Instagram
          </button>

          <button
            className={styles.option}
            onClick={handleCopyLink}
            role="menuitem"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Copiar link
          </button>
        </div>
      )}

      {copyTooltip && (
        <div className={styles.tooltip} role="status" aria-live="polite">
          {copyTooltip}
        </div>
      )}
    </div>
  )
}

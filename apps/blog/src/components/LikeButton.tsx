'use client'

import { useState, useEffect, useCallback } from 'react'
import styles from './LikeButton.module.css'

const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3001'

interface LikeButtonProps {
  postSlug: string
  initialLikeCount: number
}

export default function LikeButton({ postSlug, initialLikeCount }: LikeButtonProps) {
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [userLiked, setUserLiked] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showTooltip, setShowTooltip] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [loading, setLoading] = useState(false)

  // Check session and fetch initial like state
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${ADMIN_URL}/api/auth/session`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.user && data.accessToken) {
            setIsLoggedIn(true)
            setAccessToken(data.accessToken)

            // Fetch user's like status
            const likeRes = await fetch(
              `${ADMIN_URL}/api/blog/posts/${encodeURIComponent(postSlug)}/likes`,
              { headers: { Authorization: `Bearer ${data.accessToken}` } }
            )
            if (likeRes.ok) {
              const likeData = await likeRes.json()
              setLikeCount(likeData.likeCount)
              setUserLiked(likeData.userLiked)
            }
          } else {
            // Fetch public like count without auth
            const likeRes = await fetch(
              `${ADMIN_URL}/api/blog/posts/${encodeURIComponent(postSlug)}/likes`
            )
            if (likeRes.ok) {
              const likeData = await likeRes.json()
              setLikeCount(likeData.likeCount)
            }
          }
        }
      } catch { /* ignore */ }
    }
    init()
  }, [postSlug])

  const handleClick = useCallback(async () => {
    if (!isLoggedIn || !accessToken) {
      setShowTooltip(true)
      setTimeout(() => setShowTooltip(false), 2500)
      return
    }

    if (loading) return

    // Optimistic update
    const wasLiked = userLiked
    const prevCount = likeCount
    setUserLiked(!wasLiked)
    setLikeCount((c) => c + (wasLiked ? -1 : 1))

    if (!wasLiked) {
      setAnimating(true)
      setTimeout(() => setAnimating(false), 600)
    }

    setLoading(true)
    try {
      const res = await fetch(
        `${ADMIN_URL}/api/blog/posts/${encodeURIComponent(postSlug)}/likes`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )

      if (res.ok) {
        const data = await res.json()
        setLikeCount(data.likeCount)
        setUserLiked(data.userLiked)
      } else {
        // Rollback
        setUserLiked(wasLiked)
        setLikeCount(prevCount)
      }
    } catch {
      // Rollback
      setUserLiked(wasLiked)
      setLikeCount(prevCount)
    } finally {
      setLoading(false)
    }
  }, [isLoggedIn, accessToken, loading, userLiked, likeCount, postSlug])

  return (
    <div className={styles.wrapper}>
      <button
        className={`${styles.button} ${userLiked ? styles.liked : ''} ${animating ? styles.pulse : ''}`}
        onClick={handleClick}
        aria-label={userLiked ? `Unlike (${likeCount} likes)` : `Like (${likeCount} likes)`}
        aria-pressed={userLiked}
        type="button"
      >
        <svg
          className={styles.heart}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={userLiked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <span className={styles.count}>{likeCount}</span>
      </button>

      {showTooltip && (
        <div className={styles.tooltip} role="tooltip">
          Login to like this post
        </div>
      )}
    </div>
  )
}

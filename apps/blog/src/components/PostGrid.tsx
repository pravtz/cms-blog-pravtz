'use client'

import { useState, useCallback } from 'react'
import type { Post } from '@/lib/api'
import PostCard from './PostCard'
import { SkeletonGrid } from './SkeletonCard'
import styles from './PostGrid.module.css'

interface PostGridProps {
  initialPosts: Post[]
  total: number
}

const PAGE_SIZE = 12

export default function PostGrid({ initialPosts, total }: PostGridProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(2) // next page to load (initial is page 1)

  const hasMore = posts.length < total

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const res = await fetch(`/api/posts?page=${page}&limit=${PAGE_SIZE}`)
      if (!res.ok) throw new Error('Failed to fetch posts')
      const data = await res.json()
      setPosts((prev) => [...prev, ...data.posts])
      setPage((p) => p + 1)
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page])

  if (posts.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <p>Nenhum artigo publicado ainda.</p>
      </div>
    )
  }

  const [featured, ...rest] = posts

  return (
    <div className={styles.wrapper}>
      {/* Mosaic: first post spans 2 columns, one regular beside it */}
      <div className={styles.mosaicRow}>
        <div className={styles.featuredCell}>
          <PostCard post={featured} featured />
        </div>
        {rest[0] && (
          <div className={styles.regularCell}>
            <PostCard post={rest[0]} />
          </div>
        )}
      </div>

      {/* Remaining posts in a 3-column grid */}
      {rest.length > 1 && (
        <div className={styles.grid} aria-label="More articles">
          {rest.slice(1).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {loading && <SkeletonGrid count={3} />}
        </div>
      )}

      {/* LoadMore */}
      {hasMore && !loading && (
        <div className={styles.loadMoreWrapper}>
          <button
            className={styles.loadMoreBtn}
            onClick={loadMore}
            aria-label="Load more articles"
          >
            Carregar mais artigos
          </button>
        </div>
      )}
      {loading && posts.length > 0 && rest.length <= 1 && (
        <div className={styles.grid}>
          <SkeletonGrid count={3} />
        </div>
      )}
    </div>
  )
}

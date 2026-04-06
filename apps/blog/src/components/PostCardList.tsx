'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Post } from '@/lib/api'
import FeedPostCard from './FeedPostCard'
import { SkeletonGrid } from './SkeletonCard'
import styles from './PostCardList.module.css'

interface PostCardListProps {
  initialPosts: Post[]
  total: number
  currentPage: number
  filters: {
    q?: string
    category?: string
    tag?: string
    year?: string
    month?: string
  }
}

const PAGE_SIZE = 20

export default function PostCardList({
  initialPosts,
  total,
  currentPage,
  filters,
}: PostCardListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Sync posts when initialPosts change (filter navigation)
  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      if (page <= 1) {
        params.delete('page')
      } else {
        params.set('page', String(page))
      }
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [router, pathname, searchParams]
  )

  // Client-side fetch when page changes (for smooth UX)
  useEffect(() => {
    if (currentPage === 1) return // already rendered server-side
    setLoading(true)

    const params = new URLSearchParams()
    params.set('page', String(currentPage))
    params.set('limit', String(PAGE_SIZE))
    if (filters.q) params.set('q', filters.q)
    if (filters.category) params.set('category', filters.category)
    if (filters.tag) params.set('tag', filters.tag)
    if (filters.year) params.set('year', filters.year)
    if (filters.month) params.set('month', filters.month)

    fetch(`/api/posts?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        setPosts(data.posts ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [currentPage, filters.q, filters.category, filters.tag, filters.year, filters.month])

  if (loading) {
    return (
      <div className={styles.wrapper}>
        <SkeletonGrid count={5} listLayout />
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className={styles.empty} role="status" aria-live="polite">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <p>Nenhum artigo encontrado.</p>
        {(filters.q || filters.category || filters.tag || filters.year) && (
          <p className={styles.emptyHint}>Tente ajustar os filtros para ver mais resultados.</p>
        )}
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <ul className={styles.list} aria-label="Lista de artigos">
        {posts.map((post) => (
          <li key={post.id}>
            <FeedPostCard post={post} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className={styles.pagination} aria-label="Paginação">
          <button
            className={styles.pageBtn}
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
          >
            ←
          </button>

          <div className={styles.pageNumbers}>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                // Show first, last, current ±2
                return (
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - currentPage) <= 2
                )
              })
              .reduce<Array<number | 'ellipsis'>>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) {
                  acc.push('ellipsis')
                }
                acc.push(p)
                return acc
              }, [])
              .map((item, i) =>
                item === 'ellipsis' ? (
                  <span key={`ellipsis-${i}`} className={styles.ellipsis}>…</span>
                ) : (
                  <button
                    key={item}
                    className={`${styles.pageBtn} ${item === currentPage ? styles.activePage : ''}`}
                    onClick={() => goToPage(item as number)}
                    aria-label={`Página ${item}`}
                    aria-current={item === currentPage ? 'page' : undefined}
                  >
                    {item}
                  </button>
                )
              )}
          </div>

          <button
            className={styles.pageBtn}
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Próxima página"
          >
            →
          </button>
        </nav>
      )}

      <p className={styles.count} aria-live="polite">
        {total === 0
          ? 'Nenhum artigo'
          : `Mostrando ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, total)} de ${total} artigo${total !== 1 ? 's' : ''}`}
      </p>
    </div>
  )
}

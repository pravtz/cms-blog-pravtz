'use client'

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { Post, Category, Tag } from '@/lib/api'
import SearchBar from './SearchBar'
import FilterBar from './FilterBar'
import PostCardList from './PostCardList'
import styles from './FeedPageClient.module.css'

interface FeedPageClientProps {
  initialPosts: Post[]
  total: number
  currentPage: number
  categories: Category[]
  tags: Tag[]
  filters: {
    q?: string
    category?: string
    tag?: string
    year?: string
    month?: string
  }
  blogName: string
}

export default function FeedPageClient({
  initialPosts,
  total,
  currentPage,
  categories,
  tags,
  filters,
  blogName,
}: FeedPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleSearch = useCallback(
    (q: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (q) {
        params.set('q', q)
      } else {
        params.delete('q')
      }
      params.delete('page')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [router, pathname, searchParams]
  )

  // Build dynamic H1
  const categoryLabel = categories.find((c) => c.slug === filters.category)?.name
  const tagLabel = tags.find((t) => t.slug === filters.tag)?.name

  let heading = `Todos os artigos — ${blogName}`
  if (filters.q) {
    heading = `Resultados para "${filters.q}"`
  } else if (categoryLabel) {
    heading = categoryLabel
  } else if (tagLabel) {
    heading = `#${tagLabel}`
  } else if (filters.year) {
    heading = filters.month
      ? `${getMonthLabel(filters.month)} de ${filters.year}`
      : `Artigos de ${filters.year}`
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.searchRow}>
        <SearchBar initialValue={filters.q ?? ''} onSearch={handleSearch} />
      </div>

      <h1 className={styles.heading}>{heading}</h1>

      <FilterBar categories={categories} tags={tags} activeFilters={filters} />

      <div className={styles.results}>
        <PostCardList
          initialPosts={initialPosts}
          total={total}
          currentPage={currentPage}
          filters={filters}
        />
      </div>
    </div>
  )
}

function getMonthLabel(month: string): string {
  const months: Record<string, string> = {
    '1': 'Janeiro', '2': 'Fevereiro', '3': 'Março', '4': 'Abril',
    '5': 'Maio', '6': 'Junho', '7': 'Julho', '8': 'Agosto',
    '9': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
  }
  return months[month] ?? month
}

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getFilteredPosts, getOwner, getCategories, getTags } from '@/lib/api'
import FeedPageClient from '@/components/FeedPageClient'
import { SkeletonGrid } from '@/components/SkeletonCard'
import styles from './page.module.css'

const BLOG_URL = process.env.NEXT_PUBLIC_BLOG_URL ?? 'http://localhost:3000'
const PAGE_SIZE = 20

interface BlogFeedPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    tag?: string
    year?: string
    month?: string
    page?: string
  }>
}

export const revalidate = 60

export async function generateMetadata(
  { searchParams }: BlogFeedPageProps
): Promise<Metadata> {
  const params = await searchParams
  const [owner, categories, tags] = await Promise.all([
    getOwner(),
    getCategories(),
    getTags(),
  ])

  const blogName = owner?.blogName || 'Nexus Blog'
  const hasQuery = !!(params.q || params.category || params.tag || params.year)

  const categoryLabel = categories.find((c) => c.slug === params.category)?.name
  const tagLabel = tags.find((t) => t.slug === params.tag)?.name

  let title = `Artigos — ${blogName}`
  let description = `Explore todos os artigos publicados em ${blogName}.`

  if (params.q) {
    title = `Busca: "${params.q}" — ${blogName}`
    description = `Resultados de busca para "${params.q}" em ${blogName}.`
  } else if (categoryLabel) {
    title = `${categoryLabel} — ${blogName}`
    description = `Artigos sobre ${categoryLabel} em ${blogName}.`
  } else if (tagLabel) {
    title = `#${tagLabel} — ${blogName}`
    description = `Artigos com a tag ${tagLabel} em ${blogName}.`
  } else if (params.year) {
    title = `Artigos de ${params.year} — ${blogName}`
    description = `Artigos publicados em ${params.year} em ${blogName}.`
  }

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      url: `${BLOG_URL}/blog`,
      title,
      description,
      siteName: blogName,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: `${BLOG_URL}/blog`,
    },
    // noindex for search queries to prevent duplicate content
    robots: hasQuery && params.q
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

export default async function BlogFeedPage({ searchParams }: BlogFeedPageProps) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10))

  const filters = {
    q: params.q,
    category: params.category,
    tag: params.tag,
    year: params.year,
    month: params.month,
  }

  const [{ posts, total }, owner, categories, tags] = await Promise.all([
    getFilteredPosts({ ...filters, page, limit: PAGE_SIZE }),
    getOwner(),
    getCategories(),
    getTags(),
  ])

  const blogName = owner?.blogName || 'Nexus Blog'

  // JSON-LD ItemList
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Artigos — ${blogName}`,
    url: `${BLOG_URL}/blog`,
    numberOfItems: total,
    itemListElement: posts.map((post, i) => ({
      '@type': 'ListItem',
      position: (page - 1) * PAGE_SIZE + i + 1,
      url: `${BLOG_URL}/blog/${post.slug}`,
      name: post.seo_title || post.title,
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <main className={styles.main}>
        <Suspense fallback={<SkeletonGrid count={5} listLayout />}>
          <FeedPageClient
            initialPosts={posts}
            total={total}
            currentPage={page}
            categories={categories}
            tags={tags}
            filters={filters}
            blogName={blogName}
          />
        </Suspense>
      </main>
    </>
  )
}

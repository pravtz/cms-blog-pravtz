import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPost, getOwner, getAllPostSlugs } from '@/lib/api'
import FloatingProgressBar from '@/components/FloatingProgressBar'
import ArticleHeader from '@/components/ArticleHeader'
import MDXContent from '@/components/MDXContent'
import RecommendationSection from '@/components/RecommendationSection'
import NewsletterCard from '@/components/NewsletterCard'
import CommentSystemPlaceholder from '@/components/CommentSystemPlaceholder'
import RBACBanner from '@/components/RBACBanner'
import styles from './page.module.css'

const BLOG_URL = process.env.NEXT_PUBLIC_BLOG_URL ?? 'http://localhost:3000'

export const revalidate = 60
export const dynamicParams = true

interface PostPageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  try {
    const slugs = await getAllPostSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params
  const [result, owner] = await Promise.all([getPost(slug), getOwner()])

  if (!result) {
    return { title: 'Post não encontrado' }
  }

  const { post } = result
  const blogName = owner?.blogName || 'Nexus Blog'
  const title = post.seo_title || post.title
  const description = post.seo_description || post.excerpt || ''
  const publishDate = post.publish_date || post.created_at
  const canonical = `${BLOG_URL}/blog/${post.slug}`

  const hreflangAlternates: Record<string, string> = {}
  if (post.language === 'pt-BR') {
    hreflangAlternates['pt-BR'] = canonical
    if (post.translation_link) {
      hreflangAlternates['en'] = post.translation_link
    }
  } else if (post.language === 'en') {
    hreflangAlternates['en'] = canonical
    if (post.translation_link) {
      hreflangAlternates['pt-BR'] = post.translation_link
    }
  }

  return {
    title,
    description,
    openGraph: {
      type: 'article',
      url: canonical,
      title,
      description,
      siteName: blogName,
      images: post.cover_image ? [{ url: post.cover_image, alt: title }] : undefined,
      publishedTime: publishDate ?? undefined,
      modifiedTime: post.updated_at,
      authors: post.author_name ? [post.author_name] : undefined,
      tags: post.tags.map((t) => t.name),
    },
    twitter: {
      card: post.cover_image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
    alternates: {
      canonical,
      languages: Object.keys(hreflangAlternates).length > 0 ? hreflangAlternates : undefined,
    },
  }
}

const RESTRICTED_VISIBILITIES = new Set(['allPrivate', 'groupPrivate', 'listPrivate'])

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params
  const [result, owner] = await Promise.all([getPost(slug), getOwner()])

  if (!result) notFound()

  const { post, recommendations } = result
  const isRestricted = RESTRICTED_VISIBILITIES.has(post.visibility)
  const blogName = owner?.blogName || 'Nexus Blog'
  const publishDate = post.publish_date || post.created_at

  // JSON-LD Article schema
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.seo_title || post.title,
    description: post.seo_description || post.excerpt || '',
    image: post.cover_image || undefined,
    datePublished: publishDate,
    dateModified: post.updated_at,
    url: `${BLOG_URL}/blog/${post.slug}`,
    author: post.author_name
      ? { '@type': 'Person', name: post.author_name }
      : undefined,
    publisher: {
      '@type': 'Organization',
      name: blogName,
      logo: owner?.avatar
        ? { '@type': 'ImageObject', url: owner.avatar }
        : undefined,
    },
    keywords: post.tags.map((t) => t.name).join(', '),
    articleSection: post.category_name || undefined,
    inLanguage: post.language,
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      <FloatingProgressBar />

      <main className={styles.main}>
        <div className={styles.container}>
          <ArticleHeader post={post} />
          {isRestricted ? (
            <div className={styles.restrictedContent}>
              {post.excerpt && (
                <p className={styles.restrictedExcerpt}>{post.excerpt}</p>
              )}
              <div className={styles.blurOverlay} aria-hidden="true" />
              <RBACBanner
                visibility={post.visibility as 'allPrivate' | 'groupPrivate' | 'listPrivate'}
              />
            </div>
          ) : (
            <MDXContent html={post.content_html} />
          )}
        </div>

        {!isRestricted && (
          <div className={styles.container}>
            <RecommendationSection posts={recommendations} />

            <section className={styles.newsletterSection}>
              <NewsletterCard />
            </section>

            <CommentSystemPlaceholder />
          </div>
        )}
      </main>
    </>
  )
}

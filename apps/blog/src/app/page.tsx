import type { Metadata } from 'next'
import { getPosts, getOwner } from '@/lib/api'
import HeroSection from '@/components/HeroSection'
import BioCard from '@/components/BioCard'
import PostGrid from '@/components/PostGrid'
import styles from './page.module.css'

const BLOG_URL = process.env.NEXT_PUBLIC_BLOG_URL ?? 'http://localhost:3000'

export const revalidate = 60 // ISR: revalidate every 60 seconds

export async function generateMetadata(): Promise<Metadata> {
  const owner = await getOwner()
  const blogName = owner?.blogName || 'Nexus Blog'
  const blogDescription = owner?.blogDescription || 'Powered by Nexus CMS'
  const ogImage = owner?.avatar ? [{ url: owner.avatar }] : []

  return {
    title: { absolute: blogName },
    description: blogDescription,
    openGraph: {
      type: 'website',
      url: BLOG_URL,
      title: blogName,
      description: blogDescription,
      images: ogImage,
      siteName: blogName,
    },
    twitter: {
      card: 'summary_large_image',
      title: blogName,
      description: blogDescription,
      images: ogImage.map((i) => i.url),
    },
    alternates: {
      canonical: BLOG_URL,
    },
  }
}

export default async function HomePage() {
  const [{ posts, total }, owner] = await Promise.all([
    getPosts(1, 12),
    getOwner(),
  ])

  const heroPost = posts[0] ?? null
  const gridPosts = posts

  const blogName = owner?.blogName || 'Nexus Blog'
  const blogDescription = owner?.blogDescription || ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${BLOG_URL}/#website`,
        url: BLOG_URL,
        name: blogName,
        description: blogDescription,
        inLanguage: 'pt-BR',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${BLOG_URL}/blog?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
      owner
        ? {
            '@type': 'Person',
            '@id': `${BLOG_URL}/#person`,
            name: owner.name,
            description: owner.bio || undefined,
            url: BLOG_URL,
            image: owner.avatar || undefined,
            sameAs: [
              owner.socialGithub,
              owner.socialLinkedin,
              owner.socialTwitter,
              owner.socialInstagram,
            ].filter(Boolean),
          }
        : null,
    ].filter(Boolean),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className={styles.main}>
        {heroPost && <HeroSection post={heroPost} />}

        <div className={styles.body}>
          <section className={styles.gridSection} aria-label="Artigos recentes">
            {gridPosts.length > 0 ? (
              <PostGrid initialPosts={gridPosts} total={total} />
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>
                Nenhum artigo publicado ainda.
              </p>
            )}
          </section>

          {owner && (
            <aside className={styles.sidebar}>
              <BioCard owner={owner} />
            </aside>
          )}
        </div>
      </main>
    </>
  )
}

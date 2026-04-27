import type { Metadata } from 'next'
import { getPosts, getOwner } from '@/lib/api'
import HeroSection from '@/components/HeroSection'
import BioCard from '@/components/BioCard'
import PostGrid from '@/components/PostGrid'
import SiteHeader from '@/components/SiteHeader'
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
  const hasPosts = gridPosts.length > 0

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
      <main id="main-content" className={styles.main}>
        <SiteHeader
          blogName={blogName}
          blogDescription={blogDescription}
        />

        {heroPost ? (
          <HeroSection post={heroPost} />
        ) : (
          <section className={styles.emptyHero} aria-labelledby="empty-title">
            <div className={styles.emptyCopy}>
              <p className={styles.emptyEyebrow}>Publicação em andamento</p>
              <h1 id="empty-title" className={styles.emptyTitle}>
                {blogName}
              </h1>
              <p className={styles.emptyDescription}>
                Ainda não há artigos públicos visíveis nesta home. Assim que o
                primeiro post publicado estiver disponível, ele aparecerá aqui
                com destaque.
              </p>
            </div>
          </section>
        )}

        <div className={styles.body}>
          <section className={styles.gridSection} aria-label="Artigos recentes">
            {hasPosts ? (
              <PostGrid initialPosts={gridPosts} total={total} />
            ) : (
              <div className={styles.emptyPanel} role="status">
                <h2 className={styles.emptyPanelTitle}>
                  Nenhum artigo publicado ainda
                </h2>
                <p className={styles.emptyPanelText}>
                  O ambiente está funcionando, mas a listagem pública ainda não
                  encontrou posts publicados e visíveis para o blog.
                </p>
                <div className={styles.emptyActions}>
                  <a href="/blog" className={styles.emptyActionSecondary}>
                    Ir para a listagem
                  </a>
                  <a href="http://localhost:3001/admin/posts" className={styles.emptyActionPrimary}>
                    Revisar posts no admin
                  </a>
                </div>
              </div>
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

import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/lib/api'
import styles from './HeroSection.module.css'

interface HeroSectionProps {
  post: Post
}

export default function HeroSection({ post }: HeroSectionProps) {
  const displayTitle = post.seo_title || post.title
  const displayExcerpt = post.excerpt || post.seo_description

  return (
    <section className={styles.hero} aria-label="Featured post">
      <Link
        href={`/blog/${post.slug}`}
        className={styles.imageWrapper}
        aria-label={post.title}
      >
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt=""
            fill
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 70vw, 900px"
            className={styles.image}
          />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden="true" />
        )}
        <div className={styles.imageOverlay} aria-hidden="true" />
      </Link>

      <div className={styles.content}>
        {post.category_name && (
          <Link
            href={`/blog?category=${post.category_slug}`}
            className={styles.category}
          >
            {post.category_name}
          </Link>
        )}

        <h1 className={styles.title}>
          <Link href={`/blog/${post.slug}`}>{displayTitle}</Link>
        </h1>

        {displayExcerpt && (
          <p className={styles.excerpt}>{displayExcerpt}</p>
        )}

        <div className={styles.meta}>
          {post.author_name && (
            <span className={styles.author}>{post.author_name}</span>
          )}
          {post.publish_date && (
            <>
              <span className={styles.dot} aria-hidden="true">·</span>
              <time dateTime={post.publish_date} className={styles.date}>
                {new Date(post.publish_date).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
            </>
          )}
          {post.reading_time && (
            <>
              <span className={styles.dot} aria-hidden="true">·</span>
              <span>{post.reading_time} min de leitura</span>
            </>
          )}
        </div>

        <Link href={`/blog/${post.slug}`} className={styles.cta}>
          Ler artigo
        </Link>
      </div>
    </section>
  )
}

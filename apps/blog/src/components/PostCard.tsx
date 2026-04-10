import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/lib/api'
import LikeButton from './LikeButton'
import styles from './PostCard.module.css'

interface PostCardProps {
  post: Post
  featured?: boolean
}

const PRIVATE_VISIBILITIES = new Set(['allPrivate', 'groupPrivate', 'listPrivate', 'iPrivate'])

export default function PostCard({ post, featured = false }: PostCardProps) {
  const displayTitle = post.seo_title || post.title
  const displayExcerpt = post.excerpt || post.seo_description
  const publishDate = post.publish_date || post.created_at
  const isPrivate = PRIVATE_VISIBILITIES.has(post.visibility)

  return (
    <article className={`${styles.card} ${featured ? styles.featured : ''}`}>
      <Link href={`/blog/${post.slug}`} className={styles.imageWrapper} tabIndex={-1} aria-hidden="true">
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt=""
            fill
            sizes={
              featured
                ? '(max-width: 768px) 100vw, 50vw'
                : '(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px'
            }
            className={styles.image}
          />
        ) : (
          <div className={styles.imagePlaceholder} />
        )}
      </Link>

      <div className={styles.body}>
        <div className={styles.meta}>
          {post.category_name && (
            <Link
              href={`/blog?category=${post.category_slug}`}
              className={styles.category}
            >
              {post.category_name}
            </Link>
          )}
          {post.tags.length > 0 && (
            <span className={styles.tag}>{post.tags[0].name}</span>
          )}
          {isPrivate && (
            <span className={styles.lockBadge} title="Members-only content" aria-label="Members-only content">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Members only
            </span>
          )}
        </div>

        <h2 className={styles.title}>
          <Link href={`/blog/${post.slug}`}>{displayTitle}</Link>
        </h2>

        {displayExcerpt && (
          <p className={styles.excerpt}>{displayExcerpt}</p>
        )}

        <footer className={styles.footer}>
          {post.author_name && (
            <span className={styles.author}>{post.author_name}</span>
          )}
          <div className={styles.footerRight}>
            {publishDate && (
              <time dateTime={publishDate} className={styles.date}>
                {new Date(publishDate).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </time>
            )}
            {post.reading_time && (
              <span className={styles.readTime}>{post.reading_time} min</span>
            )}
            <LikeButton postSlug={post.slug} initialLikeCount={post.like_count ?? 0} />
          </div>
        </footer>
      </div>
    </article>
  )
}

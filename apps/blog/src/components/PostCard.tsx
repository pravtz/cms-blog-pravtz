import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/lib/api'
import styles from './PostCard.module.css'

interface PostCardProps {
  post: Post
  featured?: boolean
}

export default function PostCard({ post, featured = false }: PostCardProps) {
  const displayTitle = post.seo_title || post.title
  const displayExcerpt = post.excerpt || post.seo_description
  const publishDate = post.publish_date || post.created_at

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
          </div>
        </footer>
      </div>
    </article>
  )
}

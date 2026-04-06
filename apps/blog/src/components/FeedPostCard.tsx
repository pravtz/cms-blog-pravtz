import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/lib/api'
import styles from './FeedPostCard.module.css'

interface FeedPostCardProps {
  post: Post
}

export default function FeedPostCard({ post }: FeedPostCardProps) {
  const displayTitle = post.seo_title || post.title
  const displayExcerpt = post.excerpt || post.seo_description
  const publishDate = post.publish_date || post.created_at

  return (
    <article className={styles.card}>
      <Link href={`/blog/${post.slug}`} className={styles.imageWrapper} tabIndex={-1} aria-hidden="true">
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt=""
            fill
            sizes="(max-width: 640px) 120px, 200px"
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
          {post.tags.map((tag) => (
            <Link
              key={tag.slug}
              href={`/blog?tag=${tag.slug}`}
              className={styles.tag}
            >
              {tag.name}
            </Link>
          ))}
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

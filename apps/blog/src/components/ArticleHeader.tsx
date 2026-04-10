import Image from 'next/image'
import Link from 'next/link'
import type { PostDetail } from '@/lib/api'
import LikeButton from './LikeButton'
import ShareButton from './ShareButton'
import styles from './ArticleHeader.module.css'

interface ArticleHeaderProps {
  post: PostDetail
}

export default function ArticleHeader({ post }: ArticleHeaderProps) {
  const publishDate = post.publish_date || post.created_at

  return (
    <header className={styles.header}>
      {post.cover_image && (
        <div className={styles.cover}>
          <Image
            src={post.cover_image}
            alt={post.title}
            fill
            priority
            sizes="100vw"
            className={styles.coverImage}
          />
        </div>
      )}

      <div className={styles.inner}>
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
              #{tag.name}
            </Link>
          ))}
        </div>

        <h1 className={styles.title}>{post.title}</h1>

        {post.subtitle && (
          <p className={styles.subtitle}>{post.subtitle}</p>
        )}

        <div className={styles.byline}>
          {post.author_name && (
            <span className={styles.author}>{post.author_name}</span>
          )}
          {publishDate && (
            <time dateTime={publishDate} className={styles.date}>
              {new Date(publishDate).toLocaleDateString('pt-BR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          )}
          {post.reading_time && (
            <span className={styles.readTime}>{post.reading_time} min de leitura</span>
          )}
          <LikeButton postSlug={post.slug} initialLikeCount={post.like_count ?? 0} />
          <ShareButton postSlug={post.slug} postTitle={post.seo_title || post.title} initialShareCount={post.share_count ?? 0} />
        </div>
      </div>
    </header>
  )
}

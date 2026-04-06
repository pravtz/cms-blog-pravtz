import Link from 'next/link'
import Image from 'next/image'
import type { Post } from '@/lib/api'
import styles from './RecommendationSection.module.css'

interface RecommendationSectionProps {
  posts: Post[]
}

export default function RecommendationSection({ posts }: RecommendationSectionProps) {
  if (posts.length === 0) return null

  return (
    <section className={styles.section} aria-label="Artigos relacionados">
      <h2 className={styles.heading}>Artigos relacionados</h2>
      <div className={styles.grid}>
        {posts.map((post) => {
          const publishDate = post.publish_date || post.created_at
          return (
            <article key={post.id} className={styles.card}>
              <Link href={`/blog/${post.slug}`} className={styles.imageWrapper} tabIndex={-1} aria-hidden="true">
                {post.cover_image ? (
                  <Image
                    src={post.cover_image}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className={styles.image}
                  />
                ) : (
                  <div className={styles.imagePlaceholder} />
                )}
              </Link>

              <div className={styles.body}>
                {post.category_name && (
                  <span className={styles.category}>{post.category_name}</span>
                )}
                <h3 className={styles.title}>
                  <Link href={`/blog/${post.slug}`}>{post.seo_title || post.title}</Link>
                </h3>
                {publishDate && (
                  <time dateTime={publishDate} className={styles.date}>
                    {new Date(publishDate).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </time>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

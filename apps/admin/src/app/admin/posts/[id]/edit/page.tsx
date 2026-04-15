'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { MDXEditor, type PostData } from '@/components/Editor'
import type { FrontmatterData } from '@/components/Editor'
import styles from './page.module.css'

interface RawPost {
  id: string
  title: string
  subtitle: string | null
  excerpt: string | null
  content: string
  status: 'draft' | 'published' | 'scheduled'
  visibility: FrontmatterData['visibility']
  language: string
  category_id: string | null
  cover_image: string | null
  seo_title: string | null
  seo_description: string | null
  publish_date: string | null
  translation_link: string | null
  translation_group_id: string | null
  ai_translated: number
  linked_post: { id: string; title: string; slug: string; language: string } | null
  tags: Array<{ id: string; name: string; slug: string }>
  group_ids: string[]
  list_ids: string[]
}

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>()
  const [initialData, setInitialData] = useState<PostData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Post not found')
        return r.json()
      })
      .then(({ post }: { post: RawPost }) => {
        setInitialData({
          id: post.id,
          content: post.content,
          status: post.status,
          aiTranslated: Boolean(post.ai_translated),
          frontmatter: {
            title: post.title ?? '',
            subtitle: post.subtitle ?? '',
            excerpt: post.excerpt ?? '',
            category_id: post.category_id,
            tag_ids: (post.tags ?? []).map((t) => t.id),
            group_ids: post.group_ids ?? [],
            list_ids: post.list_ids ?? [],
            publish_date: post.publish_date ?? '',
            language: post.language ?? 'pt-BR',
            visibility: post.visibility ?? 'public',
            cover_image: post.cover_image ?? '',
            translation_link: post.translation_link ?? '',
            linked_post_id: post.linked_post?.id ?? null,
            linked_post_title: post.linked_post?.title ?? '',
            seo_title: post.seo_title ?? '',
            seo_description: post.seo_description ?? '',
          },
        })
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load post')
      })
  }, [id])

  const handleSave = async (data: PostData, options?: { createSnapshot?: boolean }): Promise<{ id: string } | undefined> => {
    const body: Record<string, unknown> = {
      title: data.frontmatter.title,
      subtitle: data.frontmatter.subtitle || null,
      excerpt: data.frontmatter.excerpt || null,
      content: data.content,
      visibility: data.frontmatter.visibility,
      language: data.frontmatter.language,
      category_id: data.frontmatter.category_id,
      tag_ids: data.frontmatter.tag_ids,
      group_ids: data.frontmatter.group_ids,
      list_ids: data.frontmatter.list_ids,
      cover_image: data.frontmatter.cover_image || null,
      seo_title: data.frontmatter.seo_title || null,
      seo_description: data.frontmatter.seo_description || null,
      publish_date: data.frontmatter.publish_date || null,
      translation_link: data.frontmatter.translation_link || null,
      linked_post_id: data.frontmatter.linked_post_id ?? null,
      createSnapshot: options?.createSnapshot ?? false,
    }
    if (data.status !== undefined) {
      body.status = data.status
    }
    const res = await fetch(`/api/posts/${data.id ?? id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error('Save failed')
    return undefined
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>Error: {error}</div>
      </div>
    )
  }

  if (!initialData) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading…</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <MDXEditor initialData={initialData} onSave={handleSave} />
    </div>
  )
}

'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MDXEditor, type PostData } from '@/components/Editor'
import type { FrontmatterData } from '@/components/Editor'
import styles from './page.module.css'

function NewPostContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillTitle = searchParams.get('title') ?? ''

  const handleSave = async (data: PostData, options?: { createSnapshot?: boolean }) => {
    const method = data.id ? 'PUT' : 'POST'
    const url = data.id ? `/api/posts/${data.id}` : '/api/posts'

    const body: Record<string, unknown> = {
      title: data.frontmatter.title,
      subtitle: data.frontmatter.subtitle || null,
      excerpt: data.frontmatter.excerpt || null,
      content: data.content,
      status: data.status ?? 'draft',
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

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error('Save failed')

    if (method === 'POST') {
      const { post } = await res.json()
      return { id: post.id }
    }
  }

  return (
    <div className={styles.page}>
      <MDXEditor
        onSave={handleSave}
        initialData={prefillTitle ? { frontmatter: { title: prefillTitle } as FrontmatterData } : undefined}
      />
    </div>
  )
}

export default function NewPostPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>}>
      <NewPostContent />
    </Suspense>
  )
}

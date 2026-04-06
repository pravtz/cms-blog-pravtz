const ADMIN_URL = process.env.ADMIN_URL ?? 'http://localhost:3001'

export interface Post {
  id: string
  title: string
  subtitle: string | null
  slug: string
  excerpt: string | null
  status: string
  visibility: string
  language: string
  cover_image: string | null
  reading_time: number | null
  seo_title: string | null
  seo_description: string | null
  publish_date: string | null
  views: number
  created_at: string
  updated_at: string
  author_name: string | null
  category_name: string | null
  category_slug: string | null
  tags: Array<{ name: string; slug: string }>
}

export interface OwnerProfile {
  name: string
  bio: string
  avatar: string
  blogName: string
  blogDescription: string
  blogUrl: string
  socialGithub: string
  socialLinkedin: string
  socialTwitter: string
  socialInstagram: string
}

export interface Category {
  id: string
  name: string
  slug: string
  post_count: number
}

export interface Tag {
  id: string
  name: string
  slug: string
  post_count: number
}

export interface PostFilters {
  q?: string
  category?: string
  tag?: string
  year?: number | string
  month?: number | string
  page?: number
  limit?: number
}

export async function getPosts(page = 1, limit = 12): Promise<{ posts: Post[]; total: number }> {
  try {
    const res = await fetch(
      `${ADMIN_URL}/api/blog/posts?page=${page}&limit=${limit}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return { posts: [], total: 0 }
    return res.json()
  } catch {
    return { posts: [], total: 0 }
  }
}

export async function getFilteredPosts(
  filters: PostFilters = {}
): Promise<{ posts: Post[]; total: number; page: number; limit: number }> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit ?? 20))
  if (filters.q) params.set('q', filters.q)
  if (filters.category) params.set('category', filters.category)
  if (filters.tag) params.set('tag', filters.tag)
  if (filters.year) params.set('year', String(filters.year))
  if (filters.month) params.set('month', String(filters.month))

  try {
    const res = await fetch(
      `${ADMIN_URL}/api/blog/posts?${params.toString()}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return { posts: [], total: 0, page: 1, limit: 20 }
    return res.json()
  } catch {
    return { posts: [], total: 0, page: 1, limit: 20 }
  }
}

export async function getOwner(): Promise<OwnerProfile | null> {
  try {
    const res = await fetch(`${ADMIN_URL}/api/blog/owner`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.owner
  } catch {
    return null
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    const res = await fetch(`${ADMIN_URL}/api/blog/categories`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.categories ?? []
  } catch {
    return []
  }
}

export async function getTags(): Promise<Tag[]> {
  try {
    const res = await fetch(`${ADMIN_URL}/api/blog/tags`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.tags ?? []
  } catch {
    return []
  }
}

export interface PostDetail {
  id: string
  title: string
  subtitle: string | null
  slug: string
  excerpt: string | null
  content_html: string
  status: string
  visibility: string
  language: string
  cover_image: string | null
  reading_time: number | null
  seo_title: string | null
  seo_description: string | null
  publish_date: string | null
  translation_link: string | null
  views: number
  created_at: string
  updated_at: string
  author_name: string | null
  category_name: string | null
  category_slug: string | null
  category_id: string | null
  tags: Array<{ name: string; slug: string }>
}

export interface PostWithRecommendations {
  post: PostDetail
  recommendations: Post[]
}

export async function getPost(slug: string): Promise<PostWithRecommendations | null> {
  try {
    const res = await fetch(
      `${ADMIN_URL}/api/blog/posts/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function getAllPostSlugs(): Promise<string[]> {
  try {
    const res = await fetch(
      `${ADMIN_URL}/api/blog/posts?limit=1000&page=1`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.posts as Post[]).map((p) => p.slug)
  } catch {
    return []
  }
}

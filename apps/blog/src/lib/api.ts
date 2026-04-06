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

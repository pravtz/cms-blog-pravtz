import type { MetadataRoute } from 'next'
import { getCategories, getTags } from '@/lib/api'

const BLOG_URL = process.env.NEXT_PUBLIC_BLOG_URL ?? 'http://localhost:3000'

export const revalidate = 3600 // 1 hour

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, tags] = await Promise.all([
    getCategories(),
    getTags(),
  ])

  const categoryUrls: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${BLOG_URL}/blog?category=${cat.slug}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }))

  const tagUrls: MetadataRoute.Sitemap = tags.map((tag) => ({
    url: `${BLOG_URL}/blog?tag=${tag.slug}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  // Add current year and previous year
  const currentYear = new Date().getFullYear()
  const dateUrls: MetadataRoute.Sitemap = [currentYear, currentYear - 1].map((year) => ({
    url: `${BLOG_URL}/blog?year=${year}`,
    changeFrequency: 'monthly',
    priority: 0.4,
  }))

  return [
    {
      url: `${BLOG_URL}/blog`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...categoryUrls,
    ...tagUrls,
    ...dateUrls,
  ]
}

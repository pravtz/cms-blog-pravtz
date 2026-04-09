'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import styles from './page.module.css'
import { Badge } from '@/components'

export const dynamic = 'force-dynamic'

interface Metrics {
  publishedPosts: number
  draftPosts: number
  activeUsers: number
  pendingUsers: number
  totalViews: number
  newsletterSubscribers: number
}

interface TopPost {
  id: string
  title: string
  slug: string
  views: number
  updated_at: string
  author_name: string
}

interface ActivityItem {
  id: string
  actor_email: string | null
  action: string
  target_type: string | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  'login.success': 'Signed in',
  'login.failure': 'Failed login',
  'login.blocked': 'Login blocked',
  'user.approved': 'User approved',
  'user.rejected': 'User rejected',
  'user.suspended': 'User suspended',
  'post.created': 'Post created',
  'post.published': 'Post published',
  'post.edited': 'Post edited',
  'post.deleted': 'Post deleted',
  'group.created': 'Group created',
  'group.updated': 'Group updated',
  'group.deleted': 'Group deleted',
  'rbac.group_permissions_changed': 'Group permissions changed',
  'rbac.user_permissions_changed': 'User permissions changed',
  'settings.changed': 'Settings changed',
  'setup.completed': 'Setup completed',
}

const ACTION_COLORS: Record<string, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  'login.success': 'success',
  'login.failure': 'warning',
  'login.blocked': 'error',
  'user.approved': 'success',
  'user.rejected': 'error',
  'user.suspended': 'error',
  'post.published': 'success',
  'post.deleted': 'error',
  'group.deleted': 'error',
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function Sparkline({ value }: { value: number }) {
  // Simple decorative sparkline based on value
  const max = Math.max(value, 10)
  const points = Array.from({ length: 8 }, (_, i) => {
    const base = (value / max) * 30
    const variation = Math.sin(i * 1.3 + value) * 8
    return Math.max(2, Math.min(38, base + variation + 10))
  })
  const width = 80
  const height = 40
  const step = width / (points.length - 1)
  const path = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${i * step},${height - y}`)
    .join(' ')

  return (
    <svg width={width} height={height} aria-hidden="true" className={styles.sparkline}>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface MetricCardProps {
  label: string
  value: number
  sub?: string
  href?: string
}

function MetricCard({ label, value, sub, href }: MetricCardProps) {
  const content = (
    <div className={styles.metricCard}>
      <div className={styles.metricTop}>
        <div>
          <div className={styles.metricLabel}>{label}</div>
          <div className={styles.metricValue}>{value.toLocaleString()}</div>
          {sub && <div className={styles.metricSub}>{sub}</div>}
        </div>
        <Sparkline value={value} />
      </div>
    </div>
  )

  if (href) {
    return <Link href={href} className={styles.metricLink}>{content}</Link>
  }
  return content
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [topPosts, setTopPosts] = useState<TopPost[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    fetch('/api/admin/metrics', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setMetrics(data.metrics)
          setTopPosts(data.topPosts)
          setActivity(data.recentActivity)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>Loading dashboard…</div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Welcome back. Here&apos;s what&apos;s happening.</p>
      </div>

      {/* Metric Cards */}
      {metrics && (
        <div className={styles.metricsGrid}>
          <MetricCard
            label="Published Posts"
            value={metrics.publishedPosts}
            sub={`${metrics.draftPosts} drafts`}
            href="/admin/posts"
          />
          <MetricCard
            label="Active Users"
            value={metrics.activeUsers}
            sub={metrics.pendingUsers > 0 ? `${metrics.pendingUsers} pending approval` : undefined}
            href="/admin/users"
          />
          <MetricCard
            label="Total Views"
            value={metrics.totalViews}
            sub="across all posts"
          />
          <MetricCard
            label="Newsletter"
            value={metrics.newsletterSubscribers}
            sub="active subscribers"
          />
        </div>
      )}

      {/* Pending users banner */}
      {metrics && metrics.pendingUsers > 0 && (
        <div className={styles.pendingBanner}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>
            <strong>{metrics.pendingUsers}</strong> user{metrics.pendingUsers > 1 ? 's' : ''} waiting for approval
          </span>
          <Link href="/admin/users?status=pending_approval" className={styles.bannerAction}>
            Review now →
          </Link>
        </div>
      )}

      <div className={styles.columns}>
        {/* Activity Feed */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent Activity</h2>
            <Link href="/admin/audit" className={styles.panelLink}>View all</Link>
          </div>
          <div className={styles.activityList}>
            {activity.length === 0 ? (
              <p className={styles.empty}>No activity yet.</p>
            ) : (
              activity.map((item) => (
                <div key={item.id} className={styles.activityItem}>
                  <div className={styles.activityDot} />
                  <div className={styles.activityBody}>
                    <div className={styles.activityText}>
                      <Badge variant={ACTION_COLORS[item.action] ?? 'default'} size="sm">
                        {ACTION_LABELS[item.action] ?? item.action}
                      </Badge>
                      {item.actor_email && (
                        <span className={styles.activityActor}>{item.actor_email}</span>
                      )}
                    </div>
                    <div className={styles.activityTime}>{formatRelative(item.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Posts + Quick Actions */}
        <div className={styles.rightCol}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Top Posts</h2>
              <Link href="/admin/posts" className={styles.panelLink}>View all</Link>
            </div>
            {topPosts.length === 0 ? (
              <p className={styles.empty}>No published posts yet.</p>
            ) : (
              <ol className={styles.topPostsList}>
                {topPosts.map((post, i) => (
                  <li key={post.id} className={styles.topPost}>
                    <span className={styles.topPostRank}>{i + 1}</span>
                    <div className={styles.topPostInfo}>
                      <Link href={`/admin/posts/${post.id}/edit`} className={styles.topPostTitle}>
                        {post.title || '(Untitled)'}
                      </Link>
                      <span className={styles.topPostMeta}>{post.author_name}</span>
                    </div>
                    <span className={styles.topPostViews}>
                      {post.views.toLocaleString()} views
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Quick Actions */}
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>Quick Actions</h2>
            <div className={styles.quickActions}>
              <Link href="/admin/posts/new" className={styles.quickAction}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Post
              </Link>
              <Link href="/admin/users" className={styles.quickAction}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
                Manage Users
              </Link>
              <Link href="/admin/groups" className={styles.quickAction}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
                Groups & RBAC
              </Link>
              <Link href="/admin/audit" className={styles.quickAction}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Audit Log
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

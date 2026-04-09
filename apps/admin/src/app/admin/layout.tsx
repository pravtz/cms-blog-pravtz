'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ToastProvider } from '@/components'
import DynamicSidebar from '@/components/AdminLayout/DynamicSidebar'
import AdminHeader from '@/components/AdminLayout/AdminHeader'
import CommandPalette from '@/components/AdminLayout/CommandPalette'
import styles from './layout.module.css'

const AUTH_PATHS = [
  '/admin/login',
  '/admin/setup',
  '/admin/register',
  '/admin/confirm-email',
  '/admin/interests',
]

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingCount, setPendingCount] = useState(0)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [criticalBanner, setCriticalBanner] = useState<string | null>(null)

  const showLayout = !isAuthPath(pathname)

  // Auth guard for app pages
  useEffect(() => {
    if (!showLayout) return
    const token = localStorage.getItem('accessToken')
    if (!token) {
      router.replace('/admin/login')
    }
  }, [showLayout, router, pathname])

  // Fetch pending user count for notification badge
  useEffect(() => {
    if (!showLayout) return
    const token = localStorage.getItem('accessToken')
    if (!token) return

    fetch('/api/admin/users?status=pending_approval', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.users) {
          setPendingCount(data.users.length)
          if (data.users.length > 0) {
            setCriticalBanner(`${data.users.length} user${data.users.length > 1 ? 's' : ''} pending approval`)
          } else {
            setCriticalBanner(null)
          }
        }
      })
      .catch(() => {})
  }, [showLayout, pathname])

  if (!showLayout) {
    return (
      <ToastProvider>
        {children}
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className={styles.appShell}>
        <DynamicSidebar pendingCount={pendingCount} />

        <div className={styles.main}>
          <AdminHeader
            pendingCount={pendingCount}
            onCommandPalette={() => setPaletteOpen(true)}
          />

          {criticalBanner && (
            <div className={styles.criticalBanner} role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>{criticalBanner}</span>
              <a href="/admin/users?status=pending_approval" className={styles.bannerLink}>
                Review
              </a>
              <button
                className={styles.bannerClose}
                onClick={() => setCriticalBanner(null)}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}

          <div className={styles.content}>
            {children}
          </div>
        </div>

        {/* FAB - New Post */}
        <a
          href="/admin/posts/new"
          className={styles.fab}
          aria-label="New Post"
          title="New Post"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </a>

        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
    </ToastProvider>
  )
}

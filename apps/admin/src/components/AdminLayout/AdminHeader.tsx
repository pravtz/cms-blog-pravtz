'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import styles from './AdminHeader.module.css'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface Props {
  pendingCount: number
  onCommandPalette: () => void
}

export default function AdminHeader({ pendingCount, onCommandPalette }: Props) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = localStorage.getItem('currentUser')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        // ignore
      }
    }
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Ctrl+K opens palette
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        onCommandPalette()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCommandPalette])

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('currentUser')
    router.push('/admin/login')
  }

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <span className={styles.blogName}>Nexus CMS</span>
      </div>

      <div className={styles.right}>
        {/* Command palette trigger */}
        <button
          className={styles.paletteBtn}
          onClick={onCommandPalette}
          aria-label="Open command palette (Ctrl+K)"
          title="Open command palette (Ctrl+K)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <span className={styles.paletteShortcut}>Ctrl+K</span>
        </button>

        {/* Notifications */}
        {pendingCount > 0 && (
          <Link href="/admin/users?status=pending_approval" className={styles.notifBtn} aria-label={`${pendingCount} users pending approval`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className={styles.notifBadge}>{pendingCount > 99 ? '99+' : pendingCount}</span>
          </Link>
        )}

        {/* User dropdown */}
        <div className={styles.userMenu} ref={dropdownRef}>
          <button
            className={styles.avatarBtn}
            onClick={() => setDropdownOpen((v) => !v)}
            aria-label="User menu"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <span className={styles.avatar} aria-hidden="true">{initials}</span>
          </button>

          {dropdownOpen && (
            <div className={styles.dropdown} role="menu">
              <div className={styles.userInfo}>
                <span className={styles.userName}>{user?.name ?? 'User'}</span>
                <span className={styles.userEmail}>{user?.email}</span>
                {user?.role && (
                  <span className={styles.userRole}>{user.role}</span>
                )}
              </div>
              <hr className={styles.divider} />
              <button
                className={styles.dropdownItem}
                onClick={handleLogout}
                role="menuitem"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './CommandPalette.module.css'

interface Command {
  id: string
  label: string
  description?: string
  href?: string
  action?: () => void
  icon: React.ReactNode
}

interface Props {
  open: boolean
  onClose: () => void
}

const ICON = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  post: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  groups: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  ),
  audit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
}

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Command[] = [
    { id: 'dashboard', label: 'Go to Dashboard', href: '/admin/dashboard', icon: ICON.dashboard },
    { id: 'new-post', label: 'New Post', description: 'Create a new post', href: '/admin/posts/new', icon: ICON.plus },
    { id: 'posts', label: 'View Posts', href: '/admin/posts', icon: ICON.post },
    { id: 'users', label: 'Manage Users', href: '/admin/users', icon: ICON.users },
    { id: 'groups', label: 'Manage Groups', href: '/admin/groups', icon: ICON.groups },
    { id: 'audit', label: 'Audit Log', href: '/admin/audit', icon: ICON.audit },
    { id: 'pending', label: 'Pending Approvals', description: 'Users awaiting approval', href: '/admin/users?status=pending_approval', icon: ICON.users },
  ]

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands

  const execute = useCallback((cmd: Command) => {
    onClose()
    if (cmd.href) router.push(cmd.href)
    else cmd.action?.()
  }, [onClose, router])

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
    }
  }, [open])

  useEffect(() => {
    setSelected(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected((s) => Math.min(s + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected((s) => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filtered[selected]) execute(filtered[selected])
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, filtered, selected, execute])

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Command palette">
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputWrapper}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.searchIcon} aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            placeholder="Type a command or search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search commands"
            autoComplete="off"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <kbd className={styles.esc} aria-label="Press Escape to close">Esc</kbd>
        </div>
        <ul className={styles.list} role="listbox">
          {filtered.length === 0 ? (
            <li className={styles.empty}>No commands found</li>
          ) : (
            filtered.map((cmd, i) => (
              <li
                key={cmd.id}
                className={`${styles.item} ${i === selected ? styles.itemSelected : ''}`}
                onClick={() => execute(cmd)}
                onMouseEnter={() => setSelected(i)}
                role="option"
                aria-selected={i === selected}
              >
                <span className={styles.itemIcon}>{cmd.icon}</span>
                <span className={styles.itemText}>
                  <span className={styles.itemLabel}>{cmd.label}</span>
                  {cmd.description && (
                    <span className={styles.itemDesc}>{cmd.description}</span>
                  )}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

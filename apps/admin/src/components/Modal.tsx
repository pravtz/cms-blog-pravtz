'use client'

import React, { useEffect, useRef } from 'react'
import styles from './Modal.module.css'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  size?: ModalSize
  children: React.ReactNode
  footer?: React.ReactNode
  /** Prevent close on overlay click */
  disableOverlayClose?: boolean
  /** aria-labelledby override */
  labelId?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  children,
  footer,
  disableOverlayClose = false,
  labelId,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const titleId = labelId ?? 'modal-title'

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // Focus trap: move focus into panel when opened
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    // Store previously focused element to restore on close
    previousFocusRef.current = document.activeElement as HTMLElement | null

    // Focus first focusable element
    const getFocusableElements = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')

    const focusable = getFocusableElements()
    const preferredFocusTarget =
      panel.querySelector<HTMLElement>('[autofocus]') ??
      focusable.find((element) =>
        element.matches('input:not([type="hidden"]), textarea, select, [contenteditable="true"]'),
      ) ??
      focusable[0] ??
      panel

    preferredFocusTarget.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key === 'Tab') {
        const list = getFocusableElements()
        if (list.length === 0) return
        const first = list[0]
        const last = list[list.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
    }
  }, [open])

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className={styles.overlay}
      onClick={disableOverlayClose ? undefined : (e) => e.target === e.currentTarget && onClose()}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={`${styles.panel} ${styles[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? `${titleId}-desc` : undefined}
        tabIndex={-1}
      >
        {(title || description) && (
          <div className={styles.header}>
            <div className={styles.titleGroup}>
              {title && (
                <h2 id={titleId} className={styles.title}>
                  {title}
                </h2>
              )}
              {description && (
                <p id={`${titleId}-desc`} className={styles.description}>
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
        )}

        <div className={styles.body}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  )
}

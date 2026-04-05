'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import styles from './Toast.module.css'

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  variant: ToastVariant
  title: string
  message?: string
  duration?: number   // ms, 0 = persist
  exiting?: boolean
}

interface ToastContextValue {
  toast: (item: Omit<ToastItem, 'id'>) => void
  dismiss: (id: string) => void
}

/* ------------------------------------------------------------------ */
/*  Context                                                             */
/* ------------------------------------------------------------------ */

const ToastContext = createContext<ToastContextValue | null>(null)

const ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
}

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    // Mark as exiting first (for animation), then remove
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    )
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 300)
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (item: Omit<ToastItem, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const duration = item.duration ?? 4000
      setToasts((prev) => [...prev, { ...item, id }])

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }
    },
    [dismiss],
  )

  // Cleanup on unmount
  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((t) => clearTimeout(t))
    }
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className={styles.container}
        role="region"
        aria-live="polite"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/*  Single Toast                                                        */
/* ------------------------------------------------------------------ */

function ToastItem({
  item,
  onDismiss,
}: {
  item: ToastItem
  onDismiss: (id: string) => void
}) {
  const classes = [
    styles.toast,
    styles[item.variant],
    item.exiting ? styles.exiting : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={classes}
      role="alert"
      aria-atomic="true"
    >
      <span className={styles.icon} aria-hidden="true">
        {ICONS[item.variant]}
      </span>

      <div className={styles.content}>
        <p className={styles.title}>{item.title}</p>
        {item.message && <p className={styles.message}>{item.message}</p>}
      </div>

      <button
        type="button"
        className={styles.closeBtn}
        onClick={() => onDismiss(item.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hook                                                                */
/* ------------------------------------------------------------------ */

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }
  return ctx
}

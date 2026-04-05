import React from 'react'
import styles from './Badge.module.css'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
type BadgeSize = 'sm' | 'md' | 'lg'

interface BadgeProps {
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  children: React.ReactNode
  className?: string
}

export function Badge({
  variant = 'default',
  size = 'md',
  dot = false,
  children,
  className,
}: BadgeProps) {
  const classes = [styles.badge, styles[variant], styles[size], className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  )
}

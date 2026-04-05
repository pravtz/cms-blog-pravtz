import React from 'react'
import styles from './Button.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  as?: 'button' | 'a'
  href?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  as: Tag = 'button',
  href,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.full : '',
    loading ? styles.loading : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const commonProps = {
    className: classes,
    'aria-disabled': disabled || loading || undefined,
  }

  if (Tag === 'a' && href) {
    return (
      <a href={href} {...commonProps} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {loading && <span className={styles.spinner} aria-hidden="true" />}
        {children}
      </a>
    )
  }

  return (
    <button
      type="button"
      disabled={disabled || loading}
      {...commonProps}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {children}
    </button>
  )
}

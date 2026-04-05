import React from 'react'
import styles from './Card.module.css'

interface CardProps {
  children?: React.ReactNode
  className?: string
  elevated?: boolean
  interactive?: boolean
  onClick?: () => void
  padding?: 'none' | 'sm' | 'default'
  as?: React.ElementType
}

interface CardHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

interface CardBodyProps {
  children: React.ReactNode
  className?: string
}

interface CardFooterProps {
  children: React.ReactNode
  className?: string
}

export function Card({
  children,
  className,
  elevated = false,
  interactive = false,
  onClick,
  padding = 'default',
  as: Tag = 'div',
}: CardProps) {
  const classes = [
    styles.card,
    elevated ? styles.elevated : '',
    interactive ? styles.interactive : '',
    padding === 'none' ? styles.noPadding : '',
    padding === 'sm' ? styles.smPadding : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      className={classes}
      onClick={onClick}
      tabIndex={interactive ? 0 : undefined}
      role={interactive && onClick ? 'button' : undefined}
      onKeyDown={
        interactive && onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, actions, className }: CardHeaderProps) {
  return (
    <div className={`${styles.header} ${className ?? ''}`}>
      <div>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div>{actions}</div>}
    </div>
  )
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={`${styles.body} ${className ?? ''}`}>{children}</div>
}

export function CardFooter({ children, className }: CardFooterProps) {
  return <div className={`${styles.footer} ${className ?? ''}`}>{children}</div>
}

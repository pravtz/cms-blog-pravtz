'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components, ExtraProps } from 'react-markdown'
import type { ClassAttributes, HTMLAttributes } from 'react'
import styles from './MDXPreview.module.css'

interface MDXPreviewProps {
  content: string
}

// Handle :::type ... ::: callout syntax by pre-processing the content
function parseCallouts(content: string): string {
  return content.replace(
    /^:::(\w+)\n([\s\S]*?)^:::/gm,
    (_, type, body) =>
      `<div class="callout callout-${type}">${body.trim()}</div>`
  )
}

type CodeProps = ClassAttributes<HTMLElement> &
  HTMLAttributes<HTMLElement> &
  ExtraProps & { inline?: boolean }

type ImgProps = ClassAttributes<HTMLImageElement> &
  HTMLAttributes<HTMLImageElement> &
  ExtraProps & { src?: string; alt?: string; title?: string }

const components: Components = {
  // Code blocks
  code({ className, children, inline }: CodeProps) {
    const lang = className?.replace('language-', '') ?? ''
    if (!inline) {
      return (
        <pre className={`${styles.pre} language-${lang}`}>
          <code className={className}>{children}</code>
        </pre>
      )
    }
    return <code className={styles.inlineCode}>{children}</code>
  },
  // Blockquotes
  blockquote({ children }) {
    return <blockquote className={styles.blockquote}>{children}</blockquote>
  },
  // Images with figure/figcaption
  img({ src, alt, title }: ImgProps) {
    return (
      <figure className={styles.figure}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt ?? ''} className={styles.img} />
        {(title || alt) && (
          <figcaption className={styles.figcaption}>{title ?? alt}</figcaption>
        )}
      </figure>
    )
  },
  // Tables — wrap in scrollable container
  table({ children }) {
    return (
      <div className={styles.tableWrapper}>
        <table className={styles.table}>{children}</table>
      </div>
    )
  },
}

export function MDXPreview({ content }: MDXPreviewProps) {
  const processed = parseCallouts(content)

  return (
    <div className={styles.preview}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}

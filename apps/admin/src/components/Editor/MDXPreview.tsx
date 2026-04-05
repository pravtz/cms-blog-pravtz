'use client'

import { useEffect, useState } from 'react'
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

/**
 * Highlight a code block with Shiki (web bundle) and return the HTML string.
 * Returns null if Shiki hasn't loaded yet or highlighting fails.
 */
async function shikiHighlight(code: string, lang: string): Promise<string | null> {
  try {
    const { codeToHtml } = await import('shiki/bundle/web')
    return await codeToHtml(code, {
      lang: lang || 'text',
      theme: 'github-dark-default',
    })
  } catch {
    return null
  }
}

export function MDXPreview({ content }: MDXPreviewProps) {
  // Map of "lang|code" → highlighted HTML string
  const [highlighted, setHighlighted] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    // Extract all code blocks from the raw markdown and highlight them
    const codeBlockRe = /```(\w*)\n([\s\S]*?)```/g
    const blocks: Array<{ key: string; lang: string; code: string }> = []
    let m: RegExpExecArray | null
    while ((m = codeBlockRe.exec(content)) !== null) {
      const lang = m[1] || 'text'
      const code = m[2]
      blocks.push({ key: `${lang}\0${code}`, lang, code })
    }

    if (blocks.length === 0) return

    let cancelled = false
    Promise.all(
      blocks.map(async ({ key, lang, code }) => {
        const html = await shikiHighlight(code, lang)
        return { key, html }
      })
    ).then((results) => {
      if (cancelled) return
      setHighlighted((prev) => {
        const next = new Map(prev)
        for (const { key, html } of results) {
          if (html) next.set(key, html)
        }
        return next
      })
    })

    return () => {
      cancelled = true
    }
  }, [content])

  const processed = parseCallouts(content)

  const components: Components = {
    // Code blocks — use Shiki-highlighted HTML if available, else fall back to styled pre
    code({ className, children, inline }: CodeProps) {
      const lang = className?.replace('language-', '') ?? ''
      if (!inline) {
        const code = String(children).replace(/\n$/, '')
        const key = `${lang || 'text'}\0${code}\n`
        const shikiHtml = highlighted.get(key) ?? highlighted.get(`${lang || 'text'}\0${code}`)
        if (shikiHtml) {
          return (
            <div
              className={styles.shikiBlock}
              dangerouslySetInnerHTML={{ __html: shikiHtml }}
            />
          )
        }
        return (
          <pre className={`${styles.pre} language-${lang}`}>
            <code className={className}>{children}</code>
          </pre>
        )
      }
      return <code className={styles.inlineCode}>{children}</code>
    },
    // Styled blockquotes
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

  return (
    <div className={styles.preview}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {processed}
      </ReactMarkdown>
    </div>
  )
}

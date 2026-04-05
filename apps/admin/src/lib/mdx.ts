/**
 * Server-side MDX utilities:
 * - sanitizeMDX: sanitize raw MDX/markdown content before storing (strips XSS vectors)
 * - renderMDX: convert MDX content to styled HTML with Shiki syntax highlighting
 *
 * Both functions are safe to call from API routes and Server Components (Node.js runtime).
 */
import sanitizeHtml from 'sanitize-html'

// ── sanitizeMDX ──────────────────────────────────────────────────────────────

/**
 * Strip dangerous HTML from raw MDX content before persisting to the DB.
 * Preserves markdown syntax and safe HTML (div/span with class attributes
 * for callouts, etc.) but removes script tags, event handlers, and unsafe URLs.
 */
export function sanitizeMDX(content: string): string {
  return sanitizeHtml(content, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'strong', 'em', 'del', 's', 'sup', 'sub',
      'a', 'img',
      'ul', 'ol', 'li',
      'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'figure', 'figcaption',
      'div', 'span', 'section', 'article', 'aside',
      'details', 'summary',
    ],
    allowedAttributes: {
      '*': ['class', 'id', 'aria-label', 'aria-hidden', 'role'],
      'a': ['href', 'title', 'target', 'rel'],
      'img': ['src', 'alt', 'title', 'width', 'height', 'loading'],
      'code': ['class'],
      'pre': ['class'],
      'td': ['align', 'colspan', 'rowspan'],
      'th': ['align', 'colspan', 'rowspan', 'scope'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    disallowedTagsMode: 'discard',
    allowVulnerableTags: false,
  })
}

// ── renderMDX ─────────────────────────────────────────────────────────────────

/** Pre-process :::type ... ::: callout syntax → <div class="callout callout-type"> */
function preprocessCallouts(content: string): string {
  return content.replace(
    /^:::(\w+)\n([\s\S]*?)^:::/gm,
    (_, type, body) =>
      `<div class="callout callout-${type}">${body.trim()}</div>`
  )
}

/** Decode HTML entities so Shiki receives raw source code */
function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
}

/**
 * Replace <pre><code class="language-LANG">...</code></pre> blocks with
 * Shiki-highlighted HTML using the github-dark-default theme.
 */
async function highlightCodeBlocks(html: string): Promise<string> {
  const { codeToHtml } = await import('shiki')
  const codeBlockRe =
    /<pre><code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g

  const matches: Array<{ match: string; lang: string; code: string }> = []
  let m: RegExpExecArray | null
  while ((m = codeBlockRe.exec(html)) !== null) {
    matches.push({
      match: m[0],
      lang: m[1] ?? 'text',
      code: decodeEntities(m[2]),
    })
  }

  const results = await Promise.all(
    matches.map(async ({ match, lang, code }) => {
      try {
        const highlighted = await codeToHtml(code, {
          lang,
          theme: 'github-dark-default',
        })
        return { match, highlighted }
      } catch {
        // Unknown language — fall back to a styled plain code block
        return {
          match,
          highlighted: `<pre class="shiki-fallback"><code>${code}</code></pre>`,
        }
      }
    })
  )

  let out = html
  for (const { match, highlighted } of results) {
    // Use indexOf for exact replacement (avoids regex escaping issues)
    const idx = out.indexOf(match)
    if (idx !== -1) {
      out = out.slice(0, idx) + highlighted + out.slice(idx + match.length)
    }
  }
  return out
}

/**
 * Render MDX content to HTML suitable for display.
 *
 * Pipeline:
 *   markdown → mdast (remark-parse + remark-gfm)
 *            → hast  (remark-rehype, allowDangerousHtml for callout divs)
 *            → HTML  (hast-util-to-html)
 *            → Shiki-highlighted HTML (code blocks replaced with shiki output)
 *
 * This is intended for use in Server Components and API routes.
 * The returned HTML should be rendered via dangerouslySetInnerHTML inside
 * a trusted server component — it is generated from already-sanitized MDX.
 */
export async function renderMDX(content: string): Promise<string> {
  const { unified } = await import('unified')
  const { default: remarkParse } = await import('remark-parse')
  const { default: remarkGfm } = await import('remark-gfm')
  const { default: remarkRehype } = await import('remark-rehype')
  const { toHtml } = await import('hast-util-to-html')

  const withCallouts = preprocessCallouts(content)

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })

  const mdast = processor.parse(withCallouts)
  // processor.run returns the transformed tree (hast Root in this case)
  const hast = await processor.run(mdast) as Parameters<typeof toHtml>[0]
  const rawHtml = toHtml(hast, { allowDangerousHtml: true })

  return highlightCodeBlocks(rawHtml)
}

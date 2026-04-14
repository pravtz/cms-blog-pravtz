'use client'

import type { EditorView } from '@codemirror/view'
import styles from './EditorToolbar.module.css'

interface ToolbarProps {
  viewRef: React.MutableRefObject<EditorView | null>
  onOpenFrontmatter: () => void
  onOpenAIImageGenerator?: () => void
  aiEnabled?: boolean
}

type WrapFormat = { before: string; after: string }
type LineFormat = { prefix: string }
type InsertFormat = { insert: string }
type Format = WrapFormat | LineFormat | InsertFormat

function isWrap(f: Format): f is WrapFormat {
  return 'before' in f
}
function isLine(f: Format): f is LineFormat {
  return 'prefix' in f
}

function applyFormat(view: EditorView, format: Format) {
  const { state } = view
  const { from, to } = state.selection.main
  const selected = state.doc.sliceString(from, to)

  if (isWrap(format)) {
    const newText = selected
      ? `${format.before}${selected}${format.after}`
      : `${format.before}text${format.after}`
    view.dispatch({
      changes: { from, to, insert: newText },
      selection: selected
        ? { anchor: from, head: from + newText.length }
        : { anchor: from + format.before.length, head: from + format.before.length + 4 },
    })
  } else if (isLine(format)) {
    // Apply prefix to current line
    const line = state.doc.lineAt(from)
    const lineText = line.text
    const alreadyHas = lineText.startsWith(format.prefix)
    const newLine = alreadyHas
      ? lineText.slice(format.prefix.length)
      : format.prefix + lineText
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: newLine },
    })
  } else {
    view.dispatch({
      changes: { from, to: from, insert: format.insert },
      selection: { anchor: from + format.insert.length },
    })
  }
  view.focus()
}

function insertTable(view: EditorView) {
  const table = `| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
| Cell | Cell | Cell |
`
  const { from } = view.state.selection.main
  view.dispatch({
    changes: { from, to: from, insert: '\n' + table },
    selection: { anchor: from + 1 },
  })
  view.focus()
}

function insertCallout(view: EditorView, type: 'info' | 'warning' | 'danger' | 'success') {
  const insert = `:::${type}\nCallout message here.\n:::\n`
  const { from } = view.state.selection.main
  view.dispatch({
    changes: { from, to: from, insert: '\n' + insert },
  })
  view.focus()
}

interface ToolbarButton {
  label: string
  title: string
  action: (view: EditorView) => void
  group?: string
}

const BUTTONS: ToolbarButton[] = [
  {
    label: 'B',
    title: 'Bold',
    action: (v) => applyFormat(v, { before: '**', after: '**' }),
    group: 'inline',
  },
  {
    label: 'I',
    title: 'Italic',
    action: (v) => applyFormat(v, { before: '_', after: '_' }),
    group: 'inline',
  },
  {
    label: 'S',
    title: 'Strikethrough',
    action: (v) => applyFormat(v, { before: '~~', after: '~~' }),
    group: 'inline',
  },
  {
    label: 'H1',
    title: 'Heading 1',
    action: (v) => applyFormat(v, { prefix: '# ' }),
    group: 'headings',
  },
  {
    label: 'H2',
    title: 'Heading 2',
    action: (v) => applyFormat(v, { prefix: '## ' }),
    group: 'headings',
  },
  {
    label: 'H3',
    title: 'Heading 3',
    action: (v) => applyFormat(v, { prefix: '### ' }),
    group: 'headings',
  },
  {
    label: '🔗',
    title: 'Link',
    action: (v) => {
      const { state } = v
      const { from, to } = state.selection.main
      const selected = state.doc.sliceString(from, to)
      const insert = selected ? `[${selected}](url)` : '[link text](url)'
      v.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length - 4, head: from + insert.length - 1 },
      })
      v.focus()
    },
    group: 'inline',
  },
  {
    label: '🖼',
    title: 'Image',
    action: (v) => {
      const insert = '![Alt text](image-url)'
      const { from } = v.state.selection.main
      v.dispatch({
        changes: { from, to: from, insert },
        selection: { anchor: from + 2, head: from + 10 },
      })
      v.focus()
    },
    group: 'inline',
  },
  {
    label: '`…`',
    title: 'Inline code',
    action: (v) => applyFormat(v, { before: '`', after: '`' }),
    group: 'code',
  },
  {
    label: '```',
    title: 'Code block',
    action: (v) => applyFormat(v, { before: '```\n', after: '\n```' }),
    group: 'code',
  },
  {
    label: '❝',
    title: 'Blockquote',
    action: (v) => applyFormat(v, { prefix: '> ' }),
    group: 'blocks',
  },
  {
    label: '• List',
    title: 'Unordered list',
    action: (v) => applyFormat(v, { prefix: '- ' }),
    group: 'blocks',
  },
  {
    label: '1. List',
    title: 'Ordered list',
    action: (v) => applyFormat(v, { prefix: '1. ' }),
    group: 'blocks',
  },
  {
    label: '⊞',
    title: 'Table',
    action: (v) => insertTable(v),
    group: 'blocks',
  },
  {
    label: '—',
    title: 'Horizontal rule',
    action: (v) => applyFormat(v, { insert: '\n---\n' }),
    group: 'blocks',
  },
  {
    label: '💡 Info',
    title: 'Callout: Info',
    action: (v) => insertCallout(v, 'info'),
    group: 'callouts',
  },
  {
    label: '⚠ Warn',
    title: 'Callout: Warning',
    action: (v) => insertCallout(v, 'warning'),
    group: 'callouts',
  },
  {
    label: '🚫 Danger',
    title: 'Callout: Danger',
    action: (v) => insertCallout(v, 'danger'),
    group: 'callouts',
  },
  {
    label: '✓ Success',
    title: 'Callout: Success',
    action: (v) => insertCallout(v, 'success'),
    group: 'callouts',
  },
]

export function EditorToolbar({ viewRef, onOpenFrontmatter, onOpenAIImageGenerator, aiEnabled }: ToolbarProps) {
  const handleClick = (btn: ToolbarButton) => {
    if (!viewRef.current) return
    btn.action(viewRef.current)
  }

  const groups = Array.from(new Set(BUTTONS.map((b) => b.group)))

  return (
    <div className={styles.toolbar} role="toolbar" aria-label="Editor toolbar">
      {groups.map((group, gi) => (
        <span key={group} className={styles.group}>
          {gi > 0 && <span className={styles.separator} aria-hidden="true" />}
          {BUTTONS.filter((b) => b.group === group).map((btn) => (
            <button
              key={btn.title}
              type="button"
              className={styles.btn}
              title={btn.title}
              aria-label={btn.title}
              onClick={() => handleClick(btn)}
            >
              {btn.label}
            </button>
          ))}
        </span>
      ))}
      <span className={styles.spacer} />
      {aiEnabled && onOpenAIImageGenerator && (
        <button
          type="button"
          className={styles.aiImageBtn}
          onClick={onOpenAIImageGenerator}
          aria-label="Open AI Image Generator"
          title="Generate images with AI"
        >
          ✨ AI Image
        </button>
      )}
      <button
        type="button"
        className={styles.frontmatterBtn}
        onClick={onOpenFrontmatter}
        aria-label="Open frontmatter settings"
      >
        ⚙ Frontmatter
      </button>
    </div>
  )
}

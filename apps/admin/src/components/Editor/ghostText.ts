/**
 * CodeMirror extension for AI ghost text (inline autocomplete).
 *
 * Usage:
 *   const [effect, field, plugin] = createGhostTextExtension()
 *   // Use effect to set/clear the suggestion from outside
 *   view.dispatch({ effects: effect.of({ text: "...", pos: cursor }) })
 *   view.dispatch({ effects: effect.of(null) })
 */

import {
  Annotation,
  StateEffect,
  StateField,
  type Extension,
  type Transaction,
} from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view'

export interface GhostState {
  text: string
  pos: number
}

/** Set or clear ghost text */
export const setGhostText = StateEffect.define<GhostState | null>()

class GhostWidget extends WidgetType {
  constructor(private text: string) {
    super()
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-ghost-text'
    span.textContent = this.text
    span.setAttribute('aria-hidden', 'true')
    return span
  }

  ignoreEvent(): boolean {
    return true
  }
}

/** StateField holding the current ghost suggestion */
export const ghostTextField = StateField.define<GhostState | null>({
  create() {
    return null
  },
  update(value, tr: Transaction) {
    // Clear if document changed by user typing (not our own dispatch)
    if (tr.docChanged && !tr.annotation(ghostTextAnnotation)) {
      return null
    }
    for (const effect of tr.effects) {
      if (effect.is(setGhostText)) {
        return effect.value
      }
    }
    return value
  },
})

/** Annotation to mark our own dispatches so we don't clear ghost text on them */
export const ghostTextAnnotation = Annotation.define<boolean>()

/** DecorationSet view plugin */
const ghostDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.state.field(ghostTextField) !== update.startState.field(ghostTextField)) {
        this.decorations = this.buildDecorations(update.view)
      }
    }

    buildDecorations(view: EditorView): DecorationSet {
      const ghost = view.state.field(ghostTextField)
      if (!ghost || !ghost.text) return Decoration.none

      const cursor = view.state.selection.main.head

      // Only show ghost text if cursor is at the stored position
      if (cursor !== ghost.pos) return Decoration.none

      const widget = Decoration.widget({
        widget: new GhostWidget(ghost.text),
        side: 1,
      })

      return Decoration.set([widget.range(ghost.pos)])
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

/** CSS theme for ghost text */
const ghostTextTheme = EditorView.baseTheme({
  '.cm-ghost-text': {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    opacity: '0.6',
    pointerEvents: 'none',
    userSelect: 'none',
  },
})

/** Full ghost text extension */
export function ghostTextExtension(): Extension {
  return [ghostTextField, ghostDecorationPlugin, ghostTextTheme]
}

/**
 * Accept the full ghost text suggestion at the cursor.
 */
export function acceptGhostText(view: EditorView): boolean {
  const ghost = view.state.field(ghostTextField)
  if (!ghost) return false

  const cursor = view.state.selection.main.head
  if (cursor !== ghost.pos) return false

  view.dispatch({
    changes: { from: cursor, insert: ghost.text },
    selection: { anchor: cursor + ghost.text.length },
    effects: setGhostText.of(null),
    annotations: ghostTextAnnotation.of(true),
  })
  return true
}

/**
 * Accept one word of the ghost text suggestion.
 */
export function acceptGhostWord(view: EditorView): boolean {
  const ghost = view.state.field(ghostTextField)
  if (!ghost) return false

  const cursor = view.state.selection.main.head
  if (cursor !== ghost.pos) return false

  // Find the end of the first word (including trailing space if present)
  const match = ghost.text.match(/^\S+\s*/)
  if (!match) return false

  const word = match[0]
  const remaining = ghost.text.slice(word.length)

  view.dispatch({
    changes: { from: cursor, insert: word },
    selection: { anchor: cursor + word.length },
    effects: setGhostText.of(remaining ? { text: remaining, pos: cursor + word.length } : null),
    annotations: ghostTextAnnotation.of(true),
  })
  return true
}

/**
 * Dismiss the ghost text.
 */
export function dismissGhostText(view: EditorView): boolean {
  const ghost = view.state.field(ghostTextField)
  if (!ghost) return false
  view.dispatch({ effects: setGhostText.of(null) })
  return true
}

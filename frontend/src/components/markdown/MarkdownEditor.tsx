/**
 * MarkdownEditor - CodeMirror 6 based markdown editor with auto-save.
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface MarkdownEditorProps {
  initialContent: string
  onSave: (content: string) => Promise<void>
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
  autoSaveMs?: number
}

// Dark theme matching CrewHub
const crewHubTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'hsl(222.2 84% 4.9%)',
      color: 'hsl(210 40% 98%)',
      height: '100%',
      fontSize: '14px',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    },
    '.cm-content': {
      caretColor: 'hsl(217.2 91.2% 59.8%)',
      padding: '16px 0',
    },
    '.cm-cursor': {
      borderLeftColor: 'hsl(217.2 91.2% 59.8%)',
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'hsla(217.2, 91.2%, 59.8%, 0.3)',
    },
    '.cm-activeLine': {
      backgroundColor: 'hsla(217.2, 32.6%, 17.5%, 0.5)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'hsla(217.2, 32.6%, 17.5%, 0.5)',
    },
    '.cm-gutters': {
      backgroundColor: 'hsl(222.2 84% 4.9%)',
      color: 'hsl(215 20.2% 45.2%)',
      border: 'none',
      borderRight: '1px solid hsl(217.2, 32.6%, 17.5%)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 16px',
    },
  },
  { dark: true }
)

export function MarkdownEditor({
  initialContent,
  onSave,
  onCancel,
  onDirtyChange,
  autoSaveMs = 2500,
}: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialContentRef = useRef(initialContent)
  const isSavingRef = useRef(false)

  const getContent = useCallback(() => {
    return viewRef.current?.state.doc.toString() ?? initialContent
  }, [initialContent])

  const isDirty = useCallback(() => {
    return getContent() !== initialContentRef.current
  }, [getContent])

  const doSave = useCallback(async () => {
    if (isSavingRef.current) return
    const content = getContent()
    if (content === initialContentRef.current) return

    isSavingRef.current = true
    setSaveStatus('saving')
    try {
      await onSave(content)
      initialContentRef.current = content
      onDirtyChange?.(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus((prev) => (prev === 'saved' ? 'idle' : prev)), 2000)
    } catch {
      setSaveStatus('error')
    } finally {
      isSavingRef.current = false
    }
  }, [getContent, onSave, onDirtyChange])

  // Setup CodeMirror
  useEffect(() => {
    if (!containerRef.current) return

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          doSave()
          return true
        },
      },
      {
        key: 'Escape',
        run: () => {
          if (isDirty()) {
            if (!confirm('You have unsaved changes. Discard?')) return true
          }
          onCancel()
          return true
        },
      },
    ])

    const autoSaveListener = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      onDirtyChange?.(true)
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => doSave(), autoSaveMs)
    })

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        saveKeymap,
        autoSaveListener,
        crewHubTheme,
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    // Auto-focus
    requestAnimationFrame(() => view.focus())

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      view.destroy()
      viewRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Status bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '4px 12px',
          fontSize: 11,
          color: 'hsl(var(--muted-foreground))',
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
          gap: 8,
          flexShrink: 0,
        }}
      >
        {saveStatus === 'saving' && (
          <span style={{ color: 'hsl(var(--primary))' }}>💾 Saving...</span>
        )}
        {saveStatus === 'saved' && <span style={{ color: '#22c55e' }}>✓ Saved</span>}
        {saveStatus === 'error' && <span style={{ color: '#ef4444' }}>⚠ Save failed</span>}
        <button
          onClick={doSave}
          style={{
            padding: '2px 10px',
            borderRadius: 4,
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Save (⌘S)
        </button>
        <button
          onClick={() => {
            if (isDirty() && !confirm('You have unsaved changes. Discard?')) return
            onCancel()
          }}
          style={{
            padding: '2px 10px',
            borderRadius: 4,
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--secondary))',
            color: 'hsl(var(--foreground))',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          Cancel (Esc)
        </button>
      </div>

      {/* Editor */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'auto' }} />
    </div>
  )
}

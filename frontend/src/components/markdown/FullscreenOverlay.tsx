import { useEffect, useMemo, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { MarkdownViewer } from './MarkdownViewer'
import { TOCSidebar, extractHeadings, useActiveHeading } from './TOCSidebar'

interface FullscreenOverlayProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  content: string
  metadata?: {
    size: number
    modified: string
    lines: number
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return iso }
}

export function FullscreenOverlay({ open, onClose, title, subtitle, content, metadata }: FullscreenOverlayProps) {
  const [tocCollapsed, setTocCollapsed] = useState(false)
  const headings = useMemo(() => extractHeadings(content), [content])
  const activeId = useActiveHeading(headings)

  const handleTOCSelect = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 't' || e.key === 'T') {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          setTocCollapsed(prev => !prev)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll, disable canvas pointer events, AND block camera-controls document listeners
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Disable pointer events on all Three.js canvases to prevent camera interference
    const canvases = document.querySelectorAll('canvas')
    const prevPointerEvents: string[] = []
    canvases.forEach((canvas, i) => {
      prevPointerEvents[i] = canvas.style.pointerEvents
      canvas.style.pointerEvents = 'none'
    })

    // Notify CameraController to disable controls
    window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: true } }))

    // Block camera-controls' document-level pointermove/pointerup listeners
    // camera-controls adds these on document in bubble phase, so we capture first
    const overlayEl = document.querySelector('[data-fullscreen-overlay]') as HTMLElement | null
    const blockIfOutsideOverlay = (e: Event) => {
      // Allow events inside the overlay to propagate normally
      if (overlayEl && overlayEl.contains(e.target as Node)) return
      // Block everything else (prevents camera rotation/zoom)
      e.stopPropagation()
    }
    // Capture phase on document - runs before camera-controls' bubble listeners
    document.addEventListener('pointermove', blockIfOutsideOverlay, { capture: true })
    document.addEventListener('pointerup', blockIfOutsideOverlay, { capture: true })
    document.addEventListener('pointerdown', blockIfOutsideOverlay, { capture: true })
    document.addEventListener('wheel', blockIfOutsideOverlay, { capture: true })

    return () => {
      document.body.style.overflow = prev
      canvases.forEach((canvas, i) => {
        canvas.style.pointerEvents = prevPointerEvents[i]
      })
      window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: false } }))
      document.removeEventListener('pointermove', blockIfOutsideOverlay, { capture: true })
      document.removeEventListener('pointerup', blockIfOutsideOverlay, { capture: true })
      document.removeEventListener('pointerdown', blockIfOutsideOverlay, { capture: true })
      document.removeEventListener('wheel', blockIfOutsideOverlay, { capture: true })
    }
  }, [open])

  if (!open) return null

  const overlay = (
    <div
      data-fullscreen-overlay
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out',
        pointerEvents: 'all',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid hsl(var(--border))',
        background: 'hsl(var(--card))',
        flexShrink: 0,
      }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'hsl(var(--foreground))', margin: 0 }}>
            📄 {title}
          </h2>
          {subtitle && (
            <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{subtitle}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => setTocCollapsed(prev => !prev)}
            title="Toggle TOC (T)"
            style={{
              background: 'hsl(var(--secondary))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
              color: 'hsl(var(--foreground))',
            }}
          >
            📑 TOC
          </button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            style={{
              background: 'hsl(var(--secondary))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 6,
              width: 32,
              height: 32,
              fontSize: 16,
              cursor: 'pointer',
              color: 'hsl(var(--foreground))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body: TOC + Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {headings.length > 0 && (
          <TOCSidebar
            headings={headings}
            activeId={activeId}
            onSelect={handleTOCSelect}
            collapsed={tocCollapsed}
            onToggle={() => setTocCollapsed(prev => !prev)}
          />
        )}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px 32px',
          background: 'hsl(var(--background))',
        }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <MarkdownViewer content={content} />
          </div>
        </div>
      </div>

      {/* Footer */}
      {metadata && (
        <div style={{
          display: 'flex',
          gap: 16,
          padding: '8px 20px',
          borderTop: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))',
          fontSize: 11,
          color: 'hsl(var(--muted-foreground))',
          flexShrink: 0,
        }}>
          <span>{formatBytes(metadata.size)}</span>
          <span>{metadata.lines} lines</span>
          <span>Modified: {formatDate(metadata.modified)}</span>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )

  return createPortal(overlay, document.body)
}

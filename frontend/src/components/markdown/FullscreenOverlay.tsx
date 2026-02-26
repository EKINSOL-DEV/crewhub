import { useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MarkdownViewer } from './MarkdownViewer'
import { MarkdownEditor } from './MarkdownEditor'
import { TOCSidebar, extractHeadings, useActiveHeading } from './TOCSidebar'

const BORDER_1PX_SOLID_HSL_VAR_BORDER = '1px solid hsl(var(--border))'
const HSL_CARD = 'hsl(var(--card))'
const HSL_FOREGROUND = 'hsl(var(--foreground))'
const HSL_MUTED_FOREGROUND = 'hsl(var(--muted-foreground))'
const HSL_SECONDARY = 'hsl(var(--secondary))'

interface FullscreenOverlayProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly title: string
  readonly subtitle?: string
  readonly content: string
  readonly metadata?: {
    size: number
    modified: string
    lines: number
  }
  readonly editable?: boolean
  readonly onSave?: (content: string) => Promise<void>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** Hook to detect mobile viewport */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window === 'undefined' ? false : window.innerWidth < breakpoint
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}

export function FullscreenOverlay({
  open,
  onClose,
  title,
  subtitle,
  content,
  metadata,
  editable,
  onSave,
}: FullscreenOverlayProps) {
  const [editing, setEditing] = useState(false)
  const [currentContent, setCurrentContent] = useState(content)
  const [dirty, setDirty] = useState(false)
  const [tocOpen, setTocOpen] = useState(false)
  const isMobile = useIsMobile()

  // Sync content when prop changes
  useEffect(() => {
    setCurrentContent(content)
  }, [content])
  // Reset edit mode when overlay closes
  useEffect(() => {
    if (!open) {
      setEditing(false)
      setDirty(false)
      setTocOpen(false)
    }
  }, [open])

  const contentScrollRef = useRef<HTMLDivElement>(null)
  const headings = useMemo(() => extractHeadings(currentContent), [currentContent])
  const activeId = useActiveHeading(headings, contentScrollRef)

  const handleTOCSelect = useCallback(
    (id: string) => {
      const container = contentScrollRef.current
      const el = document.getElementById(id)
      if (el && container) {
        const top = el.offsetTop - container.offsetTop
        container.scrollTo({ top, behavior: 'smooth' })
      }
      // Close TOC overlay on mobile after selecting
      if (isMobile) setTocOpen(false)
    },
    [isMobile]
  )

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (tocOpen) {
          setTocOpen(false)
          return
        }
        onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, tocOpen])

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
    const overlayEl = document.querySelector('[data-fullscreen-overlay]') as HTMLElement | null
    const blockIfOutsideOverlay = (e: Event) => {
      if (overlayEl?.contains(e.target as Node)) return
      e.stopPropagation()
    }
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

  const hasTOC = headings.length > 0 && !editing

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
      onClick={(e) = role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click() } }}> {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
      role="presentation"
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: isMobile ? '8px 12px' : '12px 20px',
          paddingTop: isMobile ? 'max(8px, env(safe-area-inset-top, 8px))' : '12px',
          borderBottom: BORDER_1PX_SOLID_HSL_VAR_BORDER,
          background: HSL_CARD,
          flexShrink: 0,
        }}
      >
        {/* Left: TOC button (mobile) + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          {isMobile && hasTOC && (
            <button
              onClick={() => setTocOpen(true)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                background: HSL_SECONDARY,
                color: HSL_FOREGROUND,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}
              title="Table of Contents"
            >
              ☰
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                fontSize: isMobile ? 14 : 16,
                fontWeight: 600,
                color: HSL_FOREGROUND,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              📄 {title}
            </h2>
            {subtitle && !isMobile && (
              <span style={{ fontSize: 12, color: HSL_MUTED_FOREGROUND }}>{subtitle}</span>
            )}
          </div>
        </div>

        {/* Right: edit + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {editable && !editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                background: 'hsl(var(--primary))',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'hsl(var(--primary-foreground))',
                fontWeight: 500,
                minHeight: 44,
              }}
            >
              ✏️ Edit
            </button>
          )}
          {editing && dirty && (
            <span style={{ fontSize: 11, color: HSL_MUTED_FOREGROUND }}>● Unsaved</span>
          )}
          <button
            onClick={() => {
              if (editing && dirty && !confirm('You have unsaved changes. Discard?')) return
              onClose()
            }}
            title="Close (Esc)"
            style={{
              background: HSL_SECONDARY,
              border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
              borderRadius: 10,
              width: 44,
              height: 44,
              fontSize: 20,
              cursor: 'pointer',
              color: HSL_FOREGROUND,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Body: TOC + Content or Editor */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {editing && onSave ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <MarkdownEditor
              initialContent={currentContent}
              onSave={async (newContent) => {
                await onSave(newContent)
                setCurrentContent(newContent)
                setDirty(false)
              }}
              onCancel={() => {
                if (dirty && !confirm('You have unsaved changes. Discard?')) return
                setEditing(false)
                setDirty(false)
              }}
              onDirtyChange={setDirty}
            />
          </div>
        ) : (
          <>
            {/* Desktop: inline TOC sidebar */}
            {!isMobile && hasTOC && (
              <TOCSidebar headings={headings} activeId={activeId} onSelect={handleTOCSelect} />
            )}

            {/* Mobile: TOC slide-in overlay */}
            {isMobile && hasTOC && tocOpen && (
              <>
                {/* Backdrop */}
                <div
                  onClick={() = role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click() } }}> setTocOpen(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setTocOpen(false)
                  }}
                  role="presentation"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 10,
                    background: 'rgba(0,0,0,0.5)',
                  }}
                />
                {/* TOC Panel */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 'min(300px, 80vw)',
                    zIndex: 11,
                    background: HSL_CARD,
                    boxShadow: '4px 0 20px rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'slideInLeft 0.2s ease-out',
                  }}
                >
                  {/* TOC Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      paddingTop: 'max(12px, env(safe-area-inset-top, 12px))',
                      borderBottom: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: HSL_MUTED_FOREGROUND,
                      }}
                    >
                      📑 Contents
                    </span>
                    <button
                      onClick={() => setTocOpen(false)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                        background: HSL_SECONDARY,
                        color: HSL_FOREGROUND,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 16,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  {/* TOC Items */}
                  <div
                    style={{
                      flex: 1,
                      overflow: 'auto',
                      padding: '8px 0',
                      WebkitOverflowScrolling: 'touch',
                    }}
                  >
                    {headings.map((h, i) => {
                      const isActive = h.id === activeId
                      let headingFontWeight: number
                      if (isActive) {
                        headingFontWeight = 600
                      } else if (h.level === 1) {
                        headingFontWeight = 500
                      } else {
                        headingFontWeight = 400
                      }
                      return (
                        <button
                          key={`${h.id}-${i}`}
                          onClick={() => handleTOCSelect(h.id)}
                          style={{
                            display: 'block',
                            width: '100%',
                            textAlign: 'left',
                            padding: `10px 16px 10px ${16 + (h.level - 1) * 14}px`,
                            fontSize: h.level === 1 ? 14 : 13,
                            fontWeight: headingFontWeight,
                            color: isActive ? 'hsl(var(--primary))' : HSL_MUTED_FOREGROUND,
                            background: isActive ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                            border: 'none',
                            borderLeft: isActive
                              ? '3px solid hsl(var(--primary))'
                              : '3px solid transparent',
                            cursor: 'pointer',
                            minHeight: 44,
                            fontFamily: 'system-ui, sans-serif',
                          }}
                        >
                          {h.text}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            <div
              ref={contentScrollRef}
              style={{
                flex: 1,
                overflow: 'auto',
                padding: isMobile ? '16px' : '24px 32px',
                background: 'hsl(var(--background))',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <MarkdownViewer content={currentContent} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {metadata && !isMobile && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            padding: '8px 20px',
            borderTop: BORDER_1PX_SOLID_HSL_VAR_BORDER,
            background: HSL_CARD,
            fontSize: 11,
            color: HSL_MUTED_FOREGROUND,
            flexShrink: 0,
          }}
        >
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
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  )

  return createPortal(overlay, document.body)
}

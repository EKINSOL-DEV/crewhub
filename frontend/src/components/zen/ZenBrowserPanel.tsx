/**
 * ZenBrowserPanel — Embedded browser panel for Zen Mode
 *
 * Uses <iframe> on all platforms (Tauri + browser).
 * The <webview> tag is an Electron concept that does NOT work in Tauri v2
 * on macOS (WKWebView) — it silently fails. <iframe> works reliably with
 * the `frame-src: ["*"]` CSP already set in tauri.conf.json.
 *
 * URL bar: input + Go + Back + Forward + Reload
 * State (URL) is lifted up so the parent can persist it in the layout tree.
 */

import { useState, useRef, useCallback, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ZenBrowserPanelProps {
  /** Current URL (controlled — lifted to layout tree for persistence) */
  url?: string
  /** Called whenever the displayed URL changes */
  onUrlChange?: (url: string) => void
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('about:') ||
    trimmed.startsWith('file://')
  ) {
    return trimmed
  }
  // Looks like a search query if it contains spaces or no dot — pass to Google
  if (trimmed.includes(' ') || !trimmed.includes('.')) {
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`
  }
  return `https://${trimmed}`
}

// ── Nav button ─────────────────────────────────────────────────────────────────

function NavBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: disabled ? 'var(--zen-fg-dim)' : 'var(--zen-fg-muted)',
        cursor: disabled ? 'default' : 'pointer',
        fontSize: 15,
        lineHeight: 1,
        flexShrink: 0,
        transition: 'color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.color = 'var(--zen-fg)'
          e.currentTarget.style.background = 'var(--zen-bg-hover)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = disabled ? 'var(--zen-fg-dim)' : 'var(--zen-fg-muted)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ZenBrowserPanel({ url: controlledUrl = '', onUrlChange }: ZenBrowserPanelProps) {
  // The URL currently displayed in the browser area
  const [loadedUrl, setLoadedUrl] = useState(controlledUrl)
  // The text in the address bar (may differ while user is typing)
  const [inputValue, setInputValue] = useState(controlledUrl)
  const [isLoading, setIsLoading] = useState(false)
  const [iframeError, setIframeError] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync controlled prop → local state when parent changes it
  useEffect(() => {
    if (controlledUrl && controlledUrl !== loadedUrl) {
      setLoadedUrl(controlledUrl)
      setInputValue(controlledUrl)
    }
  }, [controlledUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fake progress bar animation
  const startProgress = useCallback(() => {
    setLoadProgress(10)
    setIsLoading(true)
    if (progressTimer.current) clearInterval(progressTimer.current)
    progressTimer.current = setInterval(() => {
      setLoadProgress((p) => {
        if (p >= 85) {
          clearInterval(progressTimer.current!)
          return p
        }
        return p + Math.random() * 12
      })
    }, 300)
  }, [])

  const finishProgress = useCallback(() => {
    if (progressTimer.current) clearInterval(progressTimer.current)
    setLoadProgress(100)
    setTimeout(() => {
      setIsLoading(false)
      setLoadProgress(0)
    }, 250)
  }, [])

  // Navigate to a URL
  const navigate = useCallback(
    (rawUrl: string) => {
      const url = normalizeUrl(rawUrl)
      if (!url) return

      setIframeError(false)
      setLoadedUrl(url)
      setInputValue(url)
      onUrlChange?.(url)
      startProgress()
    },
    [onUrlChange, startProgress]
  )

  const handleGo = useCallback(() => navigate(inputValue), [navigate, inputValue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') handleGo()
      if (e.key === 'Escape') setInputValue(loadedUrl)
    },
    [handleGo, loadedUrl]
  )

  const handleBack = useCallback(() => {
    // iframe doesn't expose history navigation — no-op for now
  }, [])

  const handleForward = useCallback(() => {
    // iframe doesn't expose history navigation — no-op for now
  }, [])

  const handleReload = useCallback(() => {
    setIframeError(false)
    startProgress()
    if (iframeRef.current) {
      // Force reload iframe by briefly clearing src
      const current = loadedUrl
      iframeRef.current.src = 'about:blank'
      setTimeout(() => {
        if (iframeRef.current) iframeRef.current.src = current
      }, 50)
    }
  }, [loadedUrl, startProgress])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--zen-bg)',
        overflow: 'hidden',
      }}
    >
      {/* ── URL Bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '5px 8px',
          borderBottom: '1px solid var(--zen-border)',
          background: 'var(--zen-bg)',
          flexShrink: 0,
        }}
      >
        <NavBtn onClick={handleBack} disabled title="Back (Alt+←)">
          ←
        </NavBtn>
        <NavBtn onClick={handleForward} disabled title="Forward (Alt+→)">
          →
        </NavBtn>
        <NavBtn onClick={handleReload} title={isLoading ? 'Stop' : 'Reload'}>
          {isLoading ? '✕' : '↺'}
        </NavBtn>

        {/* Address bar */}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={(e) => e.currentTarget.select()}
          placeholder="Search or enter URL…"
          spellCheck={false}
          autoComplete="off"
          style={{
            flex: 1,
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--zen-border)',
            background: 'var(--zen-bg-panel)',
            color: 'var(--zen-fg)',
            fontSize: 12,
            fontFamily: 'ui-monospace, monospace',
            outline: 'none',
            minWidth: 0,
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--zen-border-focus)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--zen-border)'
          }}
        />

        <button
          type="button"
          onClick={handleGo}
          title="Go"
          style={{
            padding: '4px 10px',
            borderRadius: 5,
            border: 'none',
            background: 'var(--zen-accent)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.85'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          Go
        </button>
      </div>

      {/* ── Progress bar ────────────────────────────────────── */}
      <div
        style={{
          height: 2,
          background: 'transparent',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              width: `${loadProgress}%`,
              background: 'var(--zen-accent)',
              transition: 'width 0.25s ease',
            }}
          />
        )}
      </div>

      {/* ── Browser content ──────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!loadedUrl ? (
          // Empty state
          <EmptyBrowserState onNavigate={navigate} />
        ) : (
          // Use <iframe> on all platforms (Tauri + browser).
          // <webview> is an Electron concept that does NOT work in Tauri v2 / WKWebView.
          // The tauri.conf.json already has frame-src: ["*"] so iframes load any URL.
          <>
            <iframe
              ref={iframeRef}
              src={loadedUrl}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                display: iframeError ? 'none' : 'block',
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation-by-user-activation"
              referrerPolicy="no-referrer-when-downgrade"
              title="Browser panel"
              onLoad={finishProgress}
              onError={() => {
                setIframeError(true)
                finishProgress()
              }}
            />
            {iframeError && (
              <IframeBlockedMessage
                url={loadedUrl}
                onOpenExternal={() => window.open(loadedUrl, '_blank')}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyBrowserState({ onNavigate }: { onNavigate: (url: string) => void }) {
  const suggestions = [
    { label: 'Google', url: 'https://www.google.com', icon: '🔍' },
    { label: 'GitHub', url: 'https://github.com', icon: '🐙' },
    { label: 'Docs', url: 'https://docs.anthropic.com', icon: '📚' },
    { label: 'HN', url: 'https://news.ycombinator.com', icon: '🟠' },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 16,
        color: 'var(--zen-fg-muted)',
      }}
    >
      <span style={{ fontSize: 40, lineHeight: 1 }}>🌐</span>
      <span style={{ fontSize: 14, fontWeight: 500 }}>Enter a URL to browse</span>

      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: 4,
        }}
      >
        {suggestions.map((s) => (
          <button
            key={s.url}
            type="button"
            onClick={() => onNavigate(s.url)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid var(--zen-border)',
              background: 'var(--zen-bg-panel)',
              color: 'var(--zen-fg-muted)',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--zen-fg)'
              e.currentTarget.style.borderColor = 'var(--zen-accent)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--zen-fg-muted)'
              e.currentTarget.style.borderColor = 'var(--zen-border)'
            }}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Iframe blocked fallback ────────────────────────────────────────────────────

function IframeBlockedMessage({
  url,
  onOpenExternal,
}: {
  url: string
  onOpenExternal: () => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 12,
        color: 'var(--zen-fg-muted)',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <span style={{ fontSize: 36 }}>🚫</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--zen-fg)', marginBottom: 6 }}>
          This page can't be embedded
        </div>
        <div style={{ fontSize: 12, color: 'var(--zen-fg-muted)', maxWidth: 280, lineHeight: 1.5 }}>
          <strong style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {url.length > 60 ? url.slice(0, 57) + '…' : url}
          </strong>{' '}
          blocks embedding via X-Frame-Options.
          <br />
          In the Tauri desktop app, this works natively.
        </div>
      </div>
      <button
        type="button"
        onClick={onOpenExternal}
        style={{
          padding: '6px 16px',
          borderRadius: 6,
          border: 'none',
          background: 'var(--zen-accent)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 4,
        }}
      >
        Open in Browser ↗
      </button>
    </div>
  )
}

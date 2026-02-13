/**
 * Dev Error Viewer - Modal UI to browse captured errors
 * Only rendered in development mode.
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getAllErrors,
  clearErrors,
  getErrorCount,
  subscribe,
  type DevError,
} from '@/lib/devErrorStore'
import { Bug, X, Trash2, Search, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'

// ── Dev Toolbar Button ─────────────────────────────────────────

export function DevToolbar() {
  const [count, setCount] = useState(getErrorCount)
  const [open, setOpen] = useState(false)
  const [flash, setFlash] = useState(false)
  const [visible, setVisible] = useState(() => {
    try { return localStorage.getItem('dev-error-viewer-visible') === 'true' } catch { return false }
  })

  useEffect(() => {
    let prevCount = getErrorCount()
    return subscribe(() => {
      const newCount = getErrorCount()
      setCount(newCount)
      if (newCount > prevCount) {
        setFlash(true)
        setTimeout(() => setFlash(false), 600)
      }
      prevCount = newCount
    })
  }, [])

  // F6 toggle
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        e.preventDefault()
        setVisible(v => {
          const next = !v
          try { localStorage.setItem('dev-error-viewer-visible', String(next)) } catch {}
          return next
        })
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  if (import.meta.env.PROD) return null
  if (!visible) return null

  return (
    <>
      {/* Floating bug button - bottom right */}
      <button
        onClick={() => setOpen(true)}
        title="Dev Error Log"
        style={{
          position: 'fixed',
          bottom: 12,
          right: 12,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 8,
          border: count > 0 ? '1px solid #f7768e40' : '1px solid #3b4261',
          background: count > 0 ? '#1a1b26ee' : '#1a1b26cc',
          color: count > 0 ? '#f7768e' : '#565f89',
          fontSize: '0.8rem',
          fontFamily: 'monospace',
          cursor: 'pointer',
          transition: 'all 0.2s',
          transform: flash ? 'scale(1.1)' : 'scale(1)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <Bug size={14} />
        {count > 0 && (
          <span style={{
            background: '#f7768e',
            color: '#1a1b26',
            borderRadius: 10,
            padding: '1px 6px',
            fontSize: '0.7rem',
            fontWeight: 700,
          }}>
            {count}
          </span>
        )}
      </button>

      {open && <ErrorViewerModal onClose={() => setOpen(false)} />}
    </>
  )
}

// ── Error Viewer Modal ─────────────────────────────────────────

function ErrorViewerModal({ onClose }: { onClose: () => void }) {
  const [errors, setErrors] = useState(getAllErrors)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    return subscribe(() => setErrors(getAllErrors()))
  }, [])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const filtered = useMemo(() => {
    let result = [...errors].reverse() // newest first
    if (typeFilter !== 'all') {
      result = result.filter(e => e.type === typeFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(e =>
        e.message.toLowerCase().includes(q) ||
        e.stack?.toLowerCase().includes(q) ||
        e.source?.toLowerCase().includes(q)
      )
    }
    return result
  }, [errors, search, typeFilter])

  const errorTypes = useMemo(() => {
    const types = new Set(errors.map(e => e.type))
    return Array.from(types).sort()
  }, [errors])

  const handleClear = useCallback(() => {
    clearErrors()
    setErrors([])
  }, [])

  const handleCopy = useCallback((error: DevError) => {
    const text = [
      `[${error.type}] ${new Date(error.timestamp).toISOString()}`,
      error.message,
      error.stack && `\nStack:\n${error.stack}`,
      error.componentStack && `\nComponent Stack:\n${error.componentStack}`,
      error.source && `\nSource: ${error.source}:${error.lineno || '?'}:${error.colno || '?'}`,
      `\nURL: ${error.url}`,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(text)
    setCopiedId(error.id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: '#0d0e16f0',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", monospace',
        color: '#a9b1d6',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid #3b4261',
        background: '#1a1b26',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bug size={18} color="#f7768e" />
          <span style={{ fontWeight: 600, fontSize: '1rem', color: '#c0caf5' }}>
            Dev Error Log
          </span>
          <span style={{ fontSize: '0.75rem', color: '#565f89' }}>
            {filtered.length} / {errors.length} errors
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleClear}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 6,
              border: '1px solid #3b4261', background: 'transparent',
              color: '#565f89', fontSize: '0.8rem', cursor: 'pointer',
            }}
            title="Clear all errors"
          >
            <Trash2 size={13} /> Clear
          </button>
          <button
            onClick={onClose}
            style={{
              padding: 6, borderRadius: 6, border: 'none',
              background: 'transparent', color: '#565f89', cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px',
        borderBottom: '1px solid #3b426180',
        background: '#1a1b26cc',
      }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#565f89' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search errors..."
            style={{
              width: '100%', padding: '7px 10px 7px 32px',
              borderRadius: 6, border: '1px solid #3b4261',
              background: '#24283b', color: '#a9b1d6',
              fontSize: '0.85rem', outline: 'none',
            }}
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          style={{
            padding: '7px 10px', borderRadius: 6,
            border: '1px solid #3b4261', background: '#24283b',
            color: '#a9b1d6', fontSize: '0.85rem', outline: 'none',
          }}
        >
          <option value="all">All types</option>
          {errorTypes.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Error List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#565f89' }}>
            {errors.length === 0 ? '🎉 No errors captured yet' : 'No errors match your filter'}
          </div>
        ) : (
          filtered.map(err => {
            const expanded = expandedId === err.id
            return (
              <div
                key={err.id}
                style={{
                  marginBottom: 4,
                  borderRadius: 6,
                  border: `1px solid ${expanded ? '#3b4261' : '#3b426140'}`,
                  background: expanded ? '#1a1b26' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                {/* Error summary row */}
                <div
                  onClick={() => setExpandedId(expanded ? null : err.id)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 12px', cursor: 'pointer',
                    fontSize: '0.82rem',
                  }}
                >
                  {expanded
                    ? <ChevronDown size={14} style={{ marginTop: 2, flexShrink: 0, color: '#565f89' }} />
                    : <ChevronRight size={14} style={{ marginTop: 2, flexShrink: 0, color: '#565f89' }} />
                  }
                  <TypeBadge type={err.type} />
                  <span style={{
                    color: '#f7768e', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: expanded ? 'normal' : 'nowrap',
                    wordBreak: 'break-word',
                  }}>
                    {err.message.slice(0, 300)}
                  </span>
                  <span style={{ color: '#565f89', fontSize: '0.72rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {formatTime(err.timestamp)}
                  </span>
                </div>

                {/* Expanded details */}
                {expanded && (
                  <div style={{
                    padding: '0 12px 12px 34px',
                    fontSize: '0.78rem',
                  }}>
                    {err.source && (
                      <div style={{ color: '#7aa2f7', marginBottom: 6 }}>
                        📁 {err.source}{err.lineno ? `:${err.lineno}` : ''}{err.colno ? `:${err.colno}` : ''}
                      </div>
                    )}
                    {err.stack && (
                      <details open style={{ marginBottom: 8 }}>
                        <summary style={{ color: '#bb9af7', cursor: 'pointer', marginBottom: 4 }}>Stack Trace</summary>
                        <pre style={{
                          background: '#24283b', padding: 10, borderRadius: 4,
                          overflow: 'auto', maxHeight: 200, fontSize: '0.72rem',
                          color: '#a9b1d6', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>
                          {err.stack}
                        </pre>
                      </details>
                    )}
                    {err.componentStack && (
                      <details style={{ marginBottom: 8 }}>
                        <summary style={{ color: '#bb9af7', cursor: 'pointer', marginBottom: 4 }}>Component Stack</summary>
                        <pre style={{
                          background: '#24283b', padding: 10, borderRadius: 4,
                          overflow: 'auto', maxHeight: 200, fontSize: '0.72rem',
                          color: '#a9b1d6', whiteSpace: 'pre-wrap',
                        }}>
                          {err.componentStack}
                        </pre>
                      </details>
                    )}
                    <div style={{ display: 'flex', gap: 12, color: '#565f89', fontSize: '0.7rem', marginTop: 4 }}>
                      <span>🕐 {new Date(err.timestamp).toLocaleString()}</span>
                      <span>🌐 {err.url}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(err) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        marginTop: 8, padding: '4px 8px', borderRadius: 4,
                        border: '1px solid #3b4261', background: 'transparent',
                        color: '#565f89', fontSize: '0.72rem', cursor: 'pointer',
                      }}
                    >
                      {copiedId === err.id ? <><Check size={11} /> Copied!</> : <><Copy size={11} /> Copy</>}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 20px',
        borderTop: '1px solid #3b426140',
        fontSize: '0.7rem',
        color: '#565f89',
        display: 'flex',
        justifyContent: 'space-between',
      }}>
        <span>Stored in localStorage • Max {200} errors</span>
        <span>{navigator.userAgent.split(' ').slice(-3).join(' ')}</span>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  'console.error': '#e0af68',
  'unhandled-exception': '#f7768e',
  'unhandled-rejection': '#ff9e64',
  'react-error': '#bb9af7',
  'custom': '#7aa2f7',
}

function TypeBadge({ type }: { type: string }) {
  const label = type.replace('unhandled-', '').replace('console.', 'c.')
  return (
    <span style={{
      flexShrink: 0,
      padding: '1px 6px',
      borderRadius: 4,
      fontSize: '0.68rem',
      fontWeight: 600,
      background: (TYPE_COLORS[type] || '#565f89') + '20',
      color: TYPE_COLORS[type] || '#565f89',
    }}>
      {label}
    </span>
  )
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - ts
  if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

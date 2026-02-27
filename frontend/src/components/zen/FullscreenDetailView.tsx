/**
 * Fullscreen Detail View
 * Split-pane overlay for Activity and Session detail panels.
 * Left 30%: Info section, Right 70%: History with sort/filter/auto-scroll controls.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { CrewSession } from '@/lib/api'
import type { ActiveTask } from '@/hooks/useActiveTasks'
import { SessionHistoryView } from '@/components/shared/SessionHistoryView'
import { useSessionHistory } from '@/components/shared/sessionHistoryUtils'
import { formatTimestamp, formatDuration, formatTokens } from '@/lib/formatters'

// ── Types ─────────────────────────────────────────────────────

interface ActivityEvent {
  id: string
  type: 'created' | 'updated' | 'removed' | 'status'
  timestamp: number
  sessionKey: string
  sessionName: string
  description: string
  icon: string
  details?: string
}

interface FullscreenDetailViewProps {
  readonly type: 'activity' | 'session'
  readonly task?: ActiveTask
  readonly session: CrewSession | null
  readonly events?: ActivityEvent[]
  readonly onClose: () => void
}

function getStatusConfig(status: string): { color: string; label: string; dot: string } {
  switch (status) {
    case 'running':
      return { color: 'var(--zen-success)', label: 'Running', dot: '●' }
    case 'done':
      return { color: 'var(--zen-fg-dim)', label: 'Completed', dot: '✓' }
    case 'failed':
      return { color: 'var(--zen-error)', label: 'Failed', dot: '✕' }
    default:
      return { color: 'var(--zen-fg-muted)', label: status || 'Unknown', dot: '○' }
  }
}

// ── Main Component ────────────────────────────────────────────

export function FullscreenDetailView({
  type,
  task,
  session,
  events: _events,
  onClose,
}: Readonly<FullscreenDetailViewProps>) {
  // History controls
  const [sortDesc, setSortDesc] = useState(true) // newest first
  const [autoScroll, setAutoScroll] = useState(true)
  const [filterText, setFilterText] = useState('')

  const historyRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)

  const sessionKey = type === 'activity' ? task?.sessionKey || undefined : session?.key || undefined
  const { messages, loading, error, usageTotals } = useSessionHistory(sessionKey, 500)

  // Filtered + sorted messages
  const displayMessages = useMemo(() => {
    let filtered = messages
    if (filterText) {
      const q = filterText.toLowerCase()
      filtered = messages.filter((m) =>
        m.content?.some(
          (b) =>
            (b.type === 'text' && b.text?.toLowerCase().includes(q)) ||
            (b.type === 'thinking' && b.thinking?.toLowerCase().includes(q))
        )
      )
    }
    const sorted = [...filtered]
    if (sortDesc) {
      sorted.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    } else {
      sorted.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
    }
    return sorted
  }, [messages, filterText, sortDesc])

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll || userScrolledRef.current) return
    const el = historyRef.current
    if (!el) return
    if (sortDesc) {
      el.scrollTop = 0
    } else {
      el.scrollTop = el.scrollHeight
    }
  }, [displayMessages, autoScroll, sortDesc])

  // Detect manual scroll → disable auto-scroll
  const handleHistoryScroll = useCallback(() => {
    userScrolledRef.current = true
  }, [])

  // Re-enable auto-scroll resets manual flag
  useEffect(() => {
    if (autoScroll) userScrolledRef.current = false
  }, [autoScroll])

  // Escape to close — use capture phase + stopPropagation to prevent
  // other Escape handlers (e.g. ZenMode exit) from also firing
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose])

  // Lock body scroll + disable canvas pointer events
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const canvases = document.querySelectorAll('canvas')
    const prevPE: string[] = []
    canvases.forEach((c, i) => {
      prevPE[i] = c.style.pointerEvents
      c.style.pointerEvents = 'none'
    })
    window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: true } }))
    return () => {
      document.body.style.overflow = prev
      canvases.forEach((c, i) => {
        c.style.pointerEvents = prevPE[i]
      })
      window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: false } }))
    }
  }, [])

  // usageTotals comes from useSessionHistory

  // Title
  const title =
    type === 'activity'
      ? task?.title || 'Activity Detail'
      : session?.displayName || session?.label || session?.key?.split(':').pop() || 'Session Detail'

  const statusConfig = task ? getStatusConfig(task.status) : null

  const overlay = (
    <button
      type="button"
      className="zen-fs-overlay"
      data-fullscreen-overlay
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (e.target === e.currentTarget) onClose()
        }
      }}
    >
      {/* Top bar */}
      <div className="zen-fs-topbar">
        <div className="zen-fs-topbar-left">
          <span className="zen-fs-topbar-icon">
            {type === 'activity' ? task?.agentIcon || '🤖' : '💬'}
          </span>
          <span className="zen-fs-topbar-title">{title}</span>
          {statusConfig && (
            <span className="zen-fs-topbar-status" style={{ color: statusConfig.color }}>
              {statusConfig.dot} {statusConfig.label}
            </span>
          )}
        </div>
        <button className="zen-fs-close" onClick={onClose} title="Close (Esc)">
          ✕
        </button>
      </div>

      {/* Split view */}
      <div className="zen-fs-split">
        {/* Left: Info (30%) */}
        <div className="zen-fs-info">
          <div className="zen-fs-info-scroll">
            <div className="zen-sd-meta">
              {type === 'activity' && task && (
                <div className="zen-sd-meta-grid">
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Title</span>
                    <span className="zen-sd-meta-value">{task.title}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Status</span>
                    <span className="zen-sd-meta-value" style={{ color: statusConfig?.color }}>
                      {statusConfig?.dot} {statusConfig?.label}
                    </span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Agent</span>
                    <span className="zen-sd-meta-value">
                      {task.agentIcon} {task.agentName || '—'}
                    </span>
                  </div>
                  {task.sessionKey && (
                    <div className="zen-sd-meta-item">
                      <span className="zen-sd-meta-label">Session Key</span>
                      <span className="zen-sd-meta-value zen-sd-mono">{task.sessionKey}</span>
                    </div>
                  )}
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Task ID</span>
                    <span className="zen-sd-meta-value zen-sd-mono">{task.id}</span>
                  </div>
                  {task.doneAt && (
                    <div className="zen-sd-meta-item">
                      <span className="zen-sd-meta-label">Completed</span>
                      <span className="zen-sd-meta-value">{formatTimestamp(task.doneAt)}</span>
                    </div>
                  )}
                </div>
              )}

              {type === 'session' && session && (
                <div className="zen-sd-meta-grid">
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Session Key</span>
                    <span className="zen-sd-meta-value zen-sd-mono">{session.key}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Model</span>
                    <span className="zen-sd-meta-value">{session.model || '—'}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Channel</span>
                    <span className="zen-sd-meta-value">{session.channel || 'direct'}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Kind</span>
                    <span className="zen-sd-meta-value">{session.kind || '—'}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Last Activity</span>
                    <span className="zen-sd-meta-value">{formatTimestamp(session.updatedAt)}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Runtime</span>
                    <span className="zen-sd-meta-value">{formatDuration(session.updatedAt)}</span>
                  </div>
                </div>
              )}

              {/* Token usage */}
              {(session?.totalTokens || usageTotals.total > 0) && (
                <>
                  <div className="zen-sd-section-title">Token Usage</div>
                  <div className="zen-sd-meta-grid">
                    {session && (
                      <>
                        <div className="zen-sd-meta-item">
                          <span className="zen-sd-meta-label">Context</span>
                          <span className="zen-sd-meta-value">
                            {formatTokens(session.contextTokens)}
                          </span>
                        </div>
                        <div className="zen-sd-meta-item">
                          <span className="zen-sd-meta-label">Total (session)</span>
                          <span className="zen-sd-meta-value">
                            {formatTokens(session.totalTokens)}
                          </span>
                        </div>
                      </>
                    )}
                    {usageTotals.total > 0 && (
                      <>
                        <div className="zen-sd-meta-item">
                          <span className="zen-sd-meta-label">Input</span>
                          <span className="zen-sd-meta-value">
                            {formatTokens(usageTotals.input)}
                          </span>
                        </div>
                        <div className="zen-sd-meta-item">
                          <span className="zen-sd-meta-label">Output</span>
                          <span className="zen-sd-meta-value">
                            {formatTokens(usageTotals.output)}
                          </span>
                        </div>
                        {usageTotals.cost > 0 && (
                          <div className="zen-sd-meta-item">
                            <span className="zen-sd-meta-label">Cost</span>
                            <span className="zen-sd-meta-value">
                              ${usageTotals.cost.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: History (70%) */}
        <div className="zen-fs-history">
          {/* Controls bar */}
          <div className="zen-fs-controls">
            <button
              className="zen-fs-control-btn"
              onClick={() => setSortDesc((d) => !d)}
              title={sortDesc ? 'Showing newest first' : 'Showing oldest first'}
            >
              {sortDesc ? '↓ Newest' : '↑ Oldest'}
            </button>

            <label className="zen-fs-control-label">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
              />{' '}
              Auto-scroll
            </label>

            <div className="zen-fs-filter-wrap">
              <span className="zen-fs-filter-icon">🔍</span>
              <input
                className="zen-fs-filter-input"
                type="text"
                placeholder="Filter messages..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              {filterText && (
                <button className="zen-fs-filter-clear" onClick={() => setFilterText('')}>
                  ✕
                </button>
              )}
            </div>

            <span className="zen-fs-msg-count">
              {displayMessages.length} of {messages.length} messages
            </span>
          </div>

          {/* Messages */}
          <div className="zen-fs-messages" ref={historyRef} onScroll={handleHistoryScroll}>
            <SessionHistoryView
              messages={displayMessages}
              loading={loading}
              error={error}
              emptyText={filterText ? 'No messages match filter' : 'No messages in history'}
              loadingText="Loading history..."
              filterText={filterText || undefined}
              showCopyButton
              toolRoleLabel="🔧 Tool"
            />
          </div>
        </div>
      </div>

      <style>{fullscreenStyles}</style>
    </button>
  )

  return createPortal(overlay, document.body)
}

// ── Styles ────────────────────────────────────────────────────

const fullscreenStyles = `
.zen-fs-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(4px);
  animation: zen-fs-fadein 0.2s ease-out;
}
@keyframes zen-fs-fadein {
  from { opacity: 0; }
  to { opacity: 1; }
}

.zen-fs-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--zen-bg-panel, #1a1a2e);
  border-bottom: 1px solid var(--zen-border, #2a2a4a);
  flex-shrink: 0;
}
.zen-fs-topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.zen-fs-topbar-icon { font-size: 18px; }
.zen-fs-topbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--zen-fg, #e0e0e0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.zen-fs-topbar-status {
  font-size: 12px;
  font-weight: 500;
}
.zen-fs-close {
  background: transparent;
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 4px;
  color: var(--zen-fg-dim, #888);
  width: 28px;
  height: 28px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.zen-fs-close:hover {
  color: var(--zen-fg, #e0e0e0);
  background: var(--zen-bg-hover, #2a2a4a);
}

.zen-fs-split {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.zen-fs-info {
  width: 30%;
  min-width: 250px;
  border-right: 1px solid var(--zen-border, #2a2a4a);
  background: var(--zen-bg-panel, #1a1a2e);
  overflow: hidden;
}
.zen-fs-info-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 12px;
}
.zen-fs-info-scroll::-webkit-scrollbar { width: 4px; }
.zen-fs-info-scroll::-webkit-scrollbar-track { background: transparent; }
.zen-fs-info-scroll::-webkit-scrollbar-thumb { background: var(--zen-border, #2a2a4a); border-radius: 2px; }

.zen-fs-history {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--zen-bg, #0f0f23);
}

.zen-fs-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: var(--zen-bg-panel, #1a1a2e);
  border-bottom: 1px solid var(--zen-border, #2a2a4a);
  flex-shrink: 0;
  flex-wrap: wrap;
}
.zen-fs-control-btn {
  background: var(--zen-bg-hover, #2a2a4a);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 4px;
  color: var(--zen-fg-dim, #aaa);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
  white-space: nowrap;
}
.zen-fs-control-btn:hover {
  color: var(--zen-fg, #e0e0e0);
  border-color: var(--zen-fg-dim, #888);
}
.zen-fs-control-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--zen-fg-dim, #aaa);
  cursor: pointer;
  white-space: nowrap;
}
.zen-fs-control-label input[type="checkbox"] {
  accent-color: var(--zen-accent, #6366f1);
}

.zen-fs-filter-wrap {
  display: flex;
  align-items: center;
  background: var(--zen-bg, #0f0f23);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 4px;
  padding: 2px 6px;
  flex: 1;
  max-width: 300px;
  min-width: 120px;
}
.zen-fs-filter-icon {
  font-size: 11px;
  margin-right: 4px;
}
.zen-fs-filter-input {
  background: transparent;
  border: none;
  outline: none;
  color: var(--zen-fg, #e0e0e0);
  font-size: 11px;
  flex: 1;
  min-width: 0;
}
.zen-fs-filter-input::placeholder {
  color: var(--zen-fg-muted, #666);
}
.zen-fs-filter-clear {
  background: transparent;
  border: none;
  color: var(--zen-fg-dim, #888);
  font-size: 10px;
  cursor: pointer;
  padding: 0 2px;
}

.zen-fs-msg-count {
  font-size: 10px;
  color: var(--zen-fg-muted, #666);
  white-space: nowrap;
  margin-left: auto;
}

.zen-fs-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
.zen-fs-messages::-webkit-scrollbar { width: 6px; }
.zen-fs-messages::-webkit-scrollbar-track { background: transparent; }
.zen-fs-messages::-webkit-scrollbar-thumb { background: var(--zen-border, #2a2a4a); border-radius: 3px; }
`

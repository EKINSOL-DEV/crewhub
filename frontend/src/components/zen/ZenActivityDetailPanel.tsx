/**
 * Zen Activity Detail Panel
 * Shows activity/task details when clicked in the Activity panel.
 * Matches Sessions detail panel pattern with Info and History tabs.
 */

import { useState, useEffect, useMemo } from 'react'
import { api, type SessionMessage, type SessionContentBlock, type CrewSession } from '@/lib/api'
import type { ActiveTask } from '@/hooks/useActiveTasks'
import { FullscreenDetailView } from './FullscreenDetailView'
import {
  formatTimestamp,
  formatDuration,
  formatTokens,
  formatMessageTime,
  formatEventTime,
} from '@/lib/formatters'

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

interface ZenActivityDetailPanelProps {
  readonly task: ActiveTask
  readonly session: CrewSession | null
  readonly events: ActivityEvent[]
  readonly onClose: () => void
}

// ── Status helpers ────────────────────────────────────────────

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

// ── Content Block Renderer ────────────────────────────────────

function ContentBlockView({ block }: { block: SessionContentBlock }) {
  // NOSONAR
  // NOSONAR: complexity from activity detail rendering with multiple activity type branches
  const [expanded, setExpanded] = useState(false)

  if (block.type === 'text' && block.text) {
    return <div className="zen-sd-text">{block.text}</div>
  }

  if (block.type === 'thinking' && block.thinking) {
    return (
      <div className="zen-sd-thinking">
        <button className="zen-sd-thinking-toggle" onClick={() => setExpanded(!expanded)}>
          💭 Thinking {expanded ? '▾' : '▸'}
        </button>
        {expanded && <pre className="zen-sd-thinking-content">{block.thinking}</pre>}
      </div>
    )
  }

  if (block.type === 'tool_use') {
    return (
      <div className="zen-sd-tool-call">
        <button className="zen-sd-tool-toggle" onClick={() => setExpanded(!expanded)}>
          🔧 {block.name || 'Tool'} {expanded ? '▾' : '▸'}
        </button>
        {expanded && block.arguments && (
          <pre className="zen-sd-tool-args">{JSON.stringify(block.arguments, null, 2)}</pre>
        )}
      </div>
    )
  }

  if (block.type === 'tool_result') {
    const text =
      block.content
        ?.map((c) => c.text)
        .filter(Boolean)
        .join('\n') || ''
    if (!text) return null
    return (
      <div className={`zen-sd-tool-result ${block.isError ? 'zen-sd-tool-error' : ''}`}>
        <button className="zen-sd-tool-toggle" onClick={() => setExpanded(!expanded)}>
          {block.isError ? '❌' : '✅'} Result {expanded ? '▾' : '▸'}
        </button>
        {expanded && <pre className="zen-sd-tool-result-content">{text}</pre>}
      </div>
    )
  }

  return null
}

// ── Message Bubble ────────────────────────────────────────────

function MessageBubble({ message }: { message: SessionMessage }) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  let messageRole: string
  if (isUser) {
    messageRole = 'user'
  } else if (isSystem) {
    messageRole = 'system'
  } else {
    messageRole = 'assistant'
  }

  return (
    <div className={`zen-sd-message zen-sd-message-${messageRole}`}>
      <div className="zen-sd-message-header">
        <span className="zen-sd-message-role">
          {(() => {
            if (isUser) return '👤 User'
            if (isSystem) return '⚙️ System'
            if (message.role === 'toolResult') return '🔧 Tool'
            return '🤖 Assistant'
          })()}
        </span>
        <div className="zen-sd-message-actions">
          {message.timestamp && (
            <span className="zen-sd-message-timestamp">{formatMessageTime(message.timestamp)}</span>
          )}
          {message.usage && (
            <span className="zen-sd-message-tokens">
              {formatTokens(message.usage.totalTokens)} tok
            </span>
          )}
          {message.model && (
            <span className="zen-sd-message-model">{message.model.split('/').pop()}</span>
          )}
        </div>
      </div>
      <div className="zen-sd-message-body">
        {message.content?.map((block) => (
          <ContentBlockView key={`${block.type}-${JSON.stringify(block)}`} block={block} />
        ))}
      </div>
    </div>
  )
}

// ── Event Timeline Item ───────────────────────────────────────

function TimelineEvent({ event, isOngoing }: { event: ActivityEvent; readonly isOngoing?: boolean }) {
  const typeColors: Record<string, string> = {
    created: 'var(--zen-success)',
    updated: 'var(--zen-info)',
    removed: 'var(--zen-error)',
    status: 'var(--zen-warning)',
  }

  return (
    <div className={`zen-ad-timeline-event ${isOngoing ? 'zen-ad-timeline-ongoing' : ''}`}>
      <div className="zen-ad-timeline-time">{formatEventTime(event.timestamp)}</div>
      <div
        className="zen-ad-timeline-dot"
        style={{ background: typeColors[event.type] || 'var(--zen-fg-muted)' }}
      />
      <div className="zen-ad-timeline-content">
        <span className="zen-ad-timeline-icon">{event.icon}</span>
        <span className="zen-ad-timeline-desc">{event.description}</span>
        {event.details && <span className="zen-ad-timeline-details">{event.details}</span>}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────

export function ZenActivityDetailPanel({
  task,
  session,
  events,
  onClose,
}: Readonly<ZenActivityDetailPanelProps>) {
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info')
  const [fullscreen, setFullscreen] = useState(false)

  const statusConfig = getStatusConfig(task.status)

  // Fetch session history if we have a session key
  useEffect(() => {
    if (!task.sessionKey) return
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getSessionHistory(task.sessionKey, 200)
      .then((res) => {
        if (cancelled) return
        const raw = res.messages || []
        const parsed: SessionMessage[] = raw
          .filter((entry: any) => entry.type === 'message' && entry.message)
          .map((entry: any) => {
            const msg = entry.message
            let content = msg.content
            if (typeof content === 'string') content = [{ type: 'text', text: content }]
            if (!Array.isArray(content)) content = []
            return {
              role: msg.role || 'unknown',
              content,
              model: msg.model || entry.model,
              usage: msg.usage,
              stopReason: msg.stopReason,
              timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : undefined,
            } as SessionMessage
          })
        setMessages(parsed)
        setLoading(false)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [task.sessionKey])

  // Filter events relevant to this task
  const taskEvents = useMemo(() => {
    if (!task.sessionKey) return events.slice(0, 20)
    return events
      .filter((e) => e.sessionKey === task.sessionKey)
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [events, task.sessionKey])

  // Ongoing = most recent event if task is running
  const ongoingEvent = task.status === 'running' && taskEvents.length > 0 ? taskEvents[0] : null

  // Token totals from history
  const totalUsage = useMemo(() => {
    let input = 0,
      output = 0,
      total = 0,
      cost = 0
    for (const m of messages) {
      if (m.usage) {
        input += m.usage.input || 0
        output += m.usage.output || 0
        total += m.usage.totalTokens || 0
        cost += m.usage.cost?.total || 0
      }
    }
    return { input, output, total, cost }
  }, [messages])

  return (
    <div className="zen-ad-panel">
      {/* Header */}
      <div className="zen-ad-header">
        <div className="zen-ad-header-info">
          <span className="zen-ad-header-icon">{task.agentIcon || '🤖'}</span>
          <span className="zen-ad-header-name">{task.title}</span>
          <span className="zen-ad-status-badge" style={{ color: statusConfig.color }}>
            {statusConfig.dot} {statusConfig.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className="zen-sd-close"
            onClick={() => setFullscreen(true)}
            title="Fullscreen"
            style={{ fontSize: 13 }}
          >
            ⛶
          </button>
          <button className="zen-sd-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreen && (
        <FullscreenDetailView
          type="activity"
          task={task}
          session={session}
          events={events}
          onClose={() => setFullscreen(false)}
        />
      )}

      {/* Tab bar */}
      <div className="zen-sd-tabs">
        <button
          className={`zen-sd-tab ${activeTab === 'info' ? 'zen-sd-tab-active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          Info
        </button>
        <button
          className={`zen-sd-tab ${activeTab === 'history' ? 'zen-sd-tab-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History {messages.length > 0 ? `(${messages.length})` : ''}
        </button>
      </div>

      {/* Content */}
      <div className="zen-sd-content">
        {activeTab === 'info' && (
          <div className="zen-sd-meta">
            <div className="zen-sd-meta-grid">
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Title</span>
                <span className="zen-sd-meta-value">{task.title}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Status</span>
                <span className="zen-sd-meta-value" style={{ color: statusConfig.color }}>
                  {statusConfig.dot} {statusConfig.label}
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
              {session && (
                <>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Model</span>
                    <span className="zen-sd-meta-value">{session.model || '—'}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Channel</span>
                    <span className="zen-sd-meta-value">{session.channel || 'direct'}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Last Activity</span>
                    <span className="zen-sd-meta-value">{formatTimestamp(session.updatedAt)}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Duration</span>
                    <span className="zen-sd-meta-value">{formatDuration(session.updatedAt)}</span>
                  </div>
                </>
              )}
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Task ID</span>
                <span className="zen-sd-meta-value zen-sd-mono">{task.id}</span>
              </div>
              {task.doneAt && (
                <div className="zen-sd-meta-item">
                  <span className="zen-sd-meta-label">Completed At</span>
                  <span className="zen-sd-meta-value">{formatTimestamp(task.doneAt)}</span>
                </div>
              )}
            </div>

            {/* Token usage section */}
            {(session?.totalTokens || totalUsage.total > 0) && (
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
                  {totalUsage.total > 0 && (
                    <>
                      <div className="zen-sd-meta-item">
                        <span className="zen-sd-meta-label">Input (history)</span>
                        <span className="zen-sd-meta-value">{formatTokens(totalUsage.input)}</span>
                      </div>
                      <div className="zen-sd-meta-item">
                        <span className="zen-sd-meta-label">Output (history)</span>
                        <span className="zen-sd-meta-value">{formatTokens(totalUsage.output)}</span>
                      </div>
                      {totalUsage.cost > 0 && (
                        <div className="zen-sd-meta-item">
                          <span className="zen-sd-meta-label">Cost</span>
                          <span className="zen-sd-meta-value">${totalUsage.cost.toFixed(4)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {/* Recent activity events */}
            {taskEvents.length > 0 && (
              <>
                <div className="zen-sd-section-title">Recent Events</div>
                <div className="zen-ad-events-mini">
                  {taskEvents.slice(0, 5).map((event) => (
                    <TimelineEvent
                      key={event.id}
                      event={event}
                      isOngoing={event === ongoingEvent}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="zen-sd-history">
            {/* Ongoing indicator */}
            {task.status === 'running' && (
              <div className="zen-ad-ongoing-banner">
                <span className="zen-thinking-dots">
                  <span />
                  <span />
                  <span />
                </span>{' '}
                Task is actively running...
              </div>
            )}

            {/* Event timeline */}
            {taskEvents.length > 0 && (
              <div className="zen-ad-timeline-section">
                <div className="zen-ad-timeline-title">Activity Timeline</div>
                {taskEvents.map((event) => (
                  <TimelineEvent key={event.id} event={event} isOngoing={event === ongoingEvent} />
                ))}
              </div>
            )}

            {/* Session history (messages) */}
            {loading && (
              <div className="zen-sd-loading">
                <div className="zen-thinking-dots">
                  <span />
                  <span />
                  <span />
                </div>
                Loading session history...
              </div>
            )}
            {error && <div className="zen-sd-error">❌ {error}</div>}
            {!loading && !error && messages.length === 0 && taskEvents.length === 0 && (
              <div className="zen-sd-empty">No history available</div>
            )}
            {messages.map((msg) => (
              <MessageBubble
                key={`${msg.timestamp || ''}-${msg.role || ''}-${msg.model || ''}-${JSON.stringify(msg.content || [])}`}
                message={msg}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

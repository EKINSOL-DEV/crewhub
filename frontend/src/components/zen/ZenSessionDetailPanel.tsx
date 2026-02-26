/**
 * Zen Session Detail Panel
 * Shows session metadata, history/transcript, and actions
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import type { SessionMessage, SessionContentBlock, CrewSession } from '@/lib/api'
import { FullscreenDetailView } from './FullscreenDetailView'
import { formatTimestamp, formatTokens, formatMessageTime } from '@/lib/formatters'

interface ZenSessionDetailPanelProps {
  readonly session: CrewSession
  readonly onClose: () => void
}

// ── Format helpers (local) ────────────────────────────────────────

function formatDuration(startTs: number): string {
  const diff = Date.now() - startTs
  const hours = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

// ── Content Block Renderer ────────────────────────────────────────

function ContentBlockView({ block }: { block: SessionContentBlock }) { // NOSONAR
  // NOSONAR: complexity from session detail with multiple content type branches
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

// ── Message Bubble ────────────────────────────────────────────────

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

  const copyContent = useCallback(() => {
    const text =
      message.content
        ?.filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n') || ''
    navigator.clipboard.writeText(text)
  }, [message])

  return (
    <div className={`zen-sd-message zen-sd-message-${messageRole}`}>
      <div className="zen-sd-message-header">
        <div className="zen-sd-message-header-top">
          <span className="zen-sd-message-role">
            {(() => {
              if (isUser) return '👤 User'
              if (isSystem) return '⚙️ System'
              if (message.role === 'toolResult') return '🔧 Tool Result'
              return '🤖 Assistant'
            })()}
          </span>
          {message.timestamp && (
            <span className="zen-sd-message-timestamp">{formatMessageTime(message.timestamp)}</span>
          )}
          <button className="zen-sd-copy-btn" onClick={copyContent} title="Copy">
            📋
          </button>
        </div>
        {(message.usage || message.model) && (
          <div className="zen-sd-message-meta-line">
            {message.usage && (
              <span className="zen-sd-message-tokens" title="Tokens used">
                {formatTokens(message.usage.totalTokens)} tok
              </span>
            )}
            {message.model && (
              <span className="zen-sd-message-model">{message.model.split('/').pop()}</span>
            )}
          </div>
        )}
      </div>
      <div className="zen-sd-message-body">
        {message.content?.map((block, i) => (
          <ContentBlockView key={`block-${i}`} block={block} />
        ))}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

export function ZenSessionDetailPanel({ session, onClose }: ZenSessionDetailPanelProps) {
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'meta' | 'history'>('meta')
  const [fullscreen, setFullscreen] = useState(false)

  // Fetch history
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    api
      .getSessionHistory(session.key, 200)
      .then((res) => {
        if (!cancelled) {
          // Raw JSONL entries have shape {type:"message", message:{role,content,...}}
          // Extract the inner message object and filter to actual messages
          const raw = res.messages || []
          const parsed: SessionMessage[] = raw
            .filter((entry: any) => entry.type === 'message' && entry.message)
            .map((entry: any) => {
              const msg = entry.message
              // Normalize content: if string, wrap in text block
              let content = msg.content
              if (typeof content === 'string') {
                content = [{ type: 'text', text: content }]
              }
              if (!Array.isArray(content)) {
                content = []
              }
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
        }
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
  }, [session.key])

  // Aggregate token usage from messages
  const totalUsage = useMemo(() => {
    let input = 0,
      output = 0,
      total = 0
    let cost = 0
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

  const displayName =
    session.displayName || session.label || session.key.split(':').pop() || 'Agent'

  return (
    <div className="zen-sd-panel">
      {/* Header */}
      <div className="zen-sd-header">
        <div className="zen-sd-header-info">
          <span className="zen-sd-header-name">{displayName}</span>
          <span className="zen-sd-header-key">{session.key}</span>
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
          type="session"
          session={session}
          onClose={() => setFullscreen(false)}
        />
      )}

      {/* Tab bar */}
      <div className="zen-sd-tabs">
        <button
          className={`zen-sd-tab ${activeTab === 'meta' ? 'zen-sd-tab-active' : ''}`}
          onClick={() => setActiveTab('meta')}
        >
          Info
        </button>
        <button
          className={`zen-sd-tab ${activeTab === 'history' ? 'zen-sd-tab-active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History ({messages.length})
        </button>
      </div>

      {/* Content */}
      <div className="zen-sd-content">
        {activeTab === 'meta' && (
          <div className="zen-sd-meta">
            {/* Metadata grid */}
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

            {/* Token usage */}
            <div className="zen-sd-section-title">Token Usage</div>
            <div className="zen-sd-meta-grid">
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Context</span>
                <span className="zen-sd-meta-value">{formatTokens(session.contextTokens)}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Total (session)</span>
                <span className="zen-sd-meta-value">{formatTokens(session.totalTokens)}</span>
              </div>
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
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="zen-sd-history">
            {loading && (
              <div className="zen-sd-loading">
                <div className="zen-thinking-dots">
                  <span />
                  <span />
                  <span />
                </div>
                Loading history...
              </div>
            )}
            {error && <div className="zen-sd-error">❌ {error}</div>}
            {!loading && !error && messages.length === 0 && (
              <div className="zen-sd-empty">No messages in history</div>
            )}
            {Array.from([...messages].reverse().entries()).map(([i, msg]) => (
              <MessageBubble key={`msg-${i}`} message={msg} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

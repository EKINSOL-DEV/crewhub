import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Zap } from 'lucide-react'
import type { CrewSession } from '@/lib/api'
import {
  fetchSessionHistory,
  subscribeToActivityUpdates,
  type LogEntry,
} from '@/services/activityService'

// ── Helpers ────────────────────────────────────────────────────

function getTimeSinceShort(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

function isActive(session: CrewSession): boolean {
  return Date.now() - session.updatedAt < 300_000
}

function escapeHtml(str: string): string {
  return str.replaceAll(/&/g, '&amp;').replaceAll(/</g, '&lt;').replaceAll(/>/g, '&gt;')
}

// ── Task Logs View ─────────────────────────────────────────────

function TaskLogsView({ session, onBack }: { session: CrewSession; onBack: () => void }) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isNearBottom = useRef(true)

  const fetchLogs = useCallback(async () => {
    try {
      const history = await fetchSessionHistory(session.key, { limit: 100 })
      setLogs(history.messages)
    } catch (err) {
      console.error('[ActiveTasksOverlay] Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }, [session.key])

  useEffect(() => {
    fetchLogs()
    // Subscribe to SSE updates
    const unsubscribe = subscribeToActivityUpdates(session.key, fetchLogs)
    return unsubscribe
  }, [fetchLogs, session.key])

  useEffect(() => {
    if (isNearBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs.length])

  const handleScroll = useCallback(() => {
    const c = scrollRef.current
    if (!c) return
    isNearBottom.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80
  }, [])

  const uuid = session.key.split(':subagent:')[1]?.slice(0, 8) || '?'
  const label = session.label || `Subagent ${uuid}`
  const active = isActive(session)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1001,
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 12px 10px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            flexShrink: 0,
            background: active ? '#22c55e' : '#64748b',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: '#f1f5f9',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {active ? 'Running' : 'Idle'} · {getTimeSinceShort(session.updatedAt)}
          </div>
        </div>
      </header>

      {/* Logs */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {loading && (
          <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, padding: 40 }}>
            Loading logs…
          </div>
        )}
        {!loading && logs.length === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: 13, padding: 40 }}>
            No log entries yet
          </div>
        )}
        {logs.map((entry, i) => {
          const isUser = entry.role === 'user'
          const isSystem = entry.role === 'system'
          const isTool = entry.role === 'tool'

          if (isSystem || isTool) {
            const content =
              typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content)
            return (
              <div
                key={`entry-${i}`}
                style={{
                  fontSize: 11,
                  color: '#475569',
                  fontFamily: 'monospace',
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'rgba(255,255,255,0.02)',
                  wordBreak: 'break-word',
                  maxHeight: 120,
                  overflow: 'hidden',
                }}
              >
                <span style={{ color: '#64748b', fontWeight: 600 }}>[{entry.role}]</span>{' '}
                {content.slice(0, 300)}
                {content.length > 300 ? '…' : ''}
              </div>
            )
          }

          // Tool calls
          const tools =
            entry.tools && entry.tools.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
                {entry.tools.map((t, ti) => (
                  <span
                    key={ti}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: 'rgba(251, 191, 36, 0.12)',
                      color: '#fbbf24',
                    }}
                  >
                    🔧 {t.name}
                  </span>
                ))}
              </div>
            ) : null

          const content =
            typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content)

          return (
            <div
              key={`item-${i}`}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
              }}
            >
              {tools}
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 13,
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                  borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: isUser ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.06)',
                  color: '#e2e8f0',
                }}
                dangerouslySetInnerHTML={{ __html: simpleFormat(content) }}
              />
              {entry.timestamp && (
                <div
                  style={{
                    fontSize: 9,
                    color: '#475569',
                    padding: '2px 4px',
                    textAlign: isUser ? 'right' : 'left',
                  }}
                >
                  {new Date(entry.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function simpleFormat(text: string): string {
  if (!text) return ''
  let html = escapeHtml(String(text))
  html = html.replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:11px">$1</code>'
  )
  html = html.replaceAll(/\n/g, '<br/>')
  return html
}

// ── Tasks List View ────────────────────────────────────────────

function TasksListView({
  sessions,
  onBack,
  onSelectTask,
}: {
  readonly sessions: CrewSession[]
  readonly onBack: () => void
  readonly onSelectTask: (session: CrewSession) => void
}) {
  const activeSessions = sessions.filter((s) => isActive(s))
  const idleSessions = sessions.filter((s) => !isActive(s))

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#0f172a',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 12px 10px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <Zap size={18} color="#a78bfa" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f1f5f9' }}>Active Tasks</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            {activeSessions.length} running · {idleSessions.length} idle
          </div>
        </div>
      </header>

      {/* List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {sessions.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#475569',
              fontSize: 14,
              padding: 60,
            }}
          >
            No active tasks
          </div>
        )}

        {activeSessions.length > 0 && (
          <>
            <div
              style={{
                padding: '12px 16px 4px',
                fontSize: 11,
                fontWeight: 600,
                color: '#22c55e',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Running ({activeSessions.length})
            </div>
            {activeSessions.map((s) => (
              <TaskRow key={s.key} session={s} onClick={() => onSelectTask(s)} />
            ))}
          </>
        )}

        {idleSessions.length > 0 && (
          <>
            <div
              style={{
                padding: '12px 16px 4px',
                fontSize: 11,
                fontWeight: 600,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Idle ({idleSessions.length})
            </div>
            {idleSessions.map((s) => (
              <TaskRow key={s.key} session={s} onClick={() => onSelectTask(s)} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function TaskRow({ session, onClick }: { session: CrewSession; onClick: () => void }) {
  const uuid = session.key.split(':subagent:')[1]?.slice(0, 8) || '?'
  const label = session.label || `Subagent ${uuid}`
  const active = isActive(session)
  const elapsed = session.updatedAt ? getTimeSinceShort(session.updatedAt) : ''
  const model = session.model || ''

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        color: '#cbd5e1',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          flexShrink: 0,
          background: active ? '#22c55e' : '#475569',
          boxShadow: active ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#e2e8f0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        {model && <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{model}</div>}
      </div>
      <div
        style={{
          fontSize: 12,
          color: '#64748b',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        <span>{elapsed}</span>
      </div>
      <span style={{ color: '#475569', fontSize: 16 }}>›</span>
    </button>
  )
}

// ── Main Overlay Controller ────────────────────────────────────

type OverlayView = { type: 'list' } | { type: 'logs'; session: CrewSession }

export function ActiveTasksOverlay({
  sessions,
  onClose,
}: {
  readonly sessions: CrewSession[]
  readonly onClose: () => void
}) {
  const [view, setView] = useState<OverlayView>({ type: 'list' })

  if (view.type === 'logs') {
    // Find fresh session data
    const fresh = sessions.find((s) => s.key === view.session.key) || view.session
    return <TaskLogsView session={fresh} onBack={() => setView({ type: 'list' })} />
  }

  return (
    <TasksListView
      sessions={sessions}
      onBack={onClose}
      onSelectTask={(s) => setView({ type: 'logs', session: s })}
    />
  )
}

// ── Header Badge Button ────────────────────────────────────────

export function ActiveTasksBadge({ count, onClick }: { count: number; onClick: () => void }) {
  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderRadius: 20,
        border: '1px solid rgba(167, 139, 250, 0.3)',
        background: 'rgba(139, 92, 246, 0.15)',
        color: '#a78bfa',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      <Zap size={13} />
      {count}
    </button>
  )
}

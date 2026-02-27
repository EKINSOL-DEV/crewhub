/**
 * Zen Sessions Panel
 * Lists all active sessions with status indicators
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { useSessionActivity } from '@/hooks/useSessionActivity'
import { useRoomsContext } from '@/contexts/RoomsContext'
import { ZenSessionDetailPanel } from './ZenSessionDetailPanel'
import type { CrewSession } from '@/lib/api'

interface ZenSessionsPanelProps {
  readonly selectedSessionKey?: string
  readonly onSelectSession: (sessionKey: string, agentName: string, agentIcon?: string) => void
  readonly roomFilter?: string | null // Filter sessions by room ID (null = show all)
}

// ── Agent icon mapping ────────────────────────────────────────────

function getAgentIcon(session: CrewSession): string {
  // Use emoji based on session kind or channel
  const kind = session.kind?.toLowerCase() || ''
  const channel = session.channel?.toLowerCase() || ''

  if (kind.includes('dev') || kind.includes('code')) return '💻'
  if (kind.includes('chat')) return '💬'
  if (kind.includes('task')) return '📋'
  if (kind.includes('research')) return '🔍'
  if (channel.includes('slack')) return '📢'
  if (channel.includes('discord')) return '🎮'
  if (channel.includes('whatsapp')) return '📱'
  if (channel.includes('telegram')) return '✈️'

  return '🤖'
}

// ── Relative time formatting ──────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return 'now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
  return `${Math.floor(diff / 86400000)}d`
}

// ── Session Item Component ────────────────────────────────────────

interface SessionItemProps {
  readonly session: CrewSession
  readonly displayName: string | null
  readonly isActive: boolean
  readonly isSelected: boolean
  readonly onSelect: () => void
}

function SessionItem({ session, displayName, isActive, isSelected, onSelect }: SessionItemProps) {
  const icon = getAgentIcon(session)
  const name =
    displayName || session.displayName || session.label || session.key.split(':').pop() || 'Agent'

  // Determine status
  const status = isActive ? 'active' : 'idle'

  return (
    <button
      type="button"
      className={`zen-session-item ${isSelected ? 'zen-session-item-selected' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
    >
      <div className="zen-session-icon">{icon}</div>

      <div className="zen-session-info">
        <div className="zen-session-name">{name}</div>
        <div className="zen-session-meta">
          <span className="zen-session-channel">{session.channel || 'direct'}</span>
          <span className="zen-session-time">{formatRelativeTime(session.updatedAt)}</span>
        </div>
      </div>

      <div className={`zen-session-status zen-session-status-${status}`} title={status}>
        <span
          className={`zen-status-dot zen-status-dot-${status === 'active' ? 'thinking' : 'idle'}`}
        />
      </div>
    </button>
  )
}

// ── Empty State ───────────────────────────────────────────────────

interface EmptyStateProps {
  readonly isFiltered?: boolean
}

function EmptyState({ isFiltered }: EmptyStateProps) {
  return (
    <div className="zen-sessions-empty">
      <div className="zen-empty-icon">{isFiltered ? '🔍' : '📋'}</div>
      <div className="zen-empty-title">{isFiltered ? 'No matching sessions' : 'No sessions'}</div>
      <div className="zen-empty-subtitle">
        {isFiltered
          ? 'No sessions in this room. Select "All Rooms" to see all sessions.'
          : 'Agent sessions will appear here'}
      </div>
    </div>
  )
}

// ── Loading State ─────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="zen-sessions-loading">
      <div className="zen-thinking-dots">
        <span />
        <span />
        <span />
      </div>
      <span>Loading sessions...</span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

export function ZenSessionsPanel({
  selectedSessionKey: _selectedSessionKey,
  onSelectSession,
  roomFilter,
}: ZenSessionsPanelProps) {
  const { sessions, loading, connected } = useSessionsStream(true)
  const { isActivelyRunning } = useSessionActivity(sessions)
  const { sessionAssignments, getRoomForSession } = useRoomsContext()
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [detailSessionKey, setDetailSessionKey] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter & sort sessions - only show chattable sessions
  const sortedSessions = useMemo(() => {
    const now = Date.now()
    const SUBAGENT_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes

    return [...sessions]
      .filter((s) => {
        // Main sessions are always chattable
        if (!s.key.includes(':main')) {
          // Subagent sessions: only show if recently active
          const age = now - s.updatedAt
          if (age > SUBAGENT_MAX_AGE_MS) return false
        }

        // Apply room filter if set
        if (roomFilter) {
          const sessionRoomId =
            sessionAssignments.get(s.key) ||
            getRoomForSession(s.key, {
              label: s.label,
              model: s.model,
              channel: s.channel,
            })
          if (sessionRoomId !== roomFilter) return false
        }

        return true
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [sessions, roomFilter, sessionAssignments, getRoomForSession])

  // Get display name from session object
  const getDisplayName = useCallback((session: CrewSession) => {
    return session.displayName || session.label || session.key.split(':').pop() || 'Agent'
  }, [])

  // Handle keyboard navigation within the list
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const list = listRef.current
      if (!list || !list.contains(document.activeElement)) return

      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setFocusedIndex((prev) => Math.min(prev + 1, sortedSessions.length - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setFocusedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const session = sortedSessions[focusedIndex]
        if (session) {
          onSelectSession(session.key, getDisplayName(session), getAgentIcon(session))
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [sortedSessions, focusedIndex, onSelectSession, getDisplayName])

  // Focus the item at focusedIndex
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const items = list.querySelectorAll('.zen-session-item')
    const item = items[focusedIndex] as HTMLElement
    if (item && document.activeElement?.closest('.zen-sessions-list')) {
      item.focus()
    }
  }, [focusedIndex])

  const handleDetailSelect = useCallback((session: CrewSession) => {
    setDetailSessionKey((prev) => (prev === session.key ? null : session.key))
  }, [])

  const detailSession = useMemo(() => {
    if (!detailSessionKey) return null
    return sessions.find((s) => s.key === detailSessionKey) || null
  }, [detailSessionKey, sessions])

  // Build the list content
  let listContent: React.ReactNode

  if (loading && sessions.length === 0) {
    listContent = <LoadingState />
  } else if (sessions.length === 0) {
    listContent = <EmptyState isFiltered={false} />
  } else if (sortedSessions.length === 0) {
    listContent = <EmptyState isFiltered={!!roomFilter} />
  } else {
    listContent = (
      <>
        {!connected && (
          <div className="zen-sessions-reconnecting">
            <span className="zen-thinking-dots">
              <span />
              <span />
              <span />
            </span>{' '}
            Reconnecting...
          </div>
        )}
        <div ref={listRef} className="zen-sessions-list" aria-label="Sessions">
          {sortedSessions.map((session, index) => (
            <SessionItem
              key={session.key}
              session={session}
              displayName={getDisplayName(session)}
              isActive={isActivelyRunning(session.key)}
              isSelected={session.key === detailSessionKey}
              onSelect={() => {
                setFocusedIndex(index)
                handleDetailSelect(session)
              }}
            />
          ))}
        </div>
        <div className="zen-sessions-footer">
          <span className="zen-sessions-count">
            {(() => {
              const sessionSuffix = sessions.length === 1 ? '' : 's'
              return roomFilter
                ? `${sortedSessions.length} of ${sessions.length} session${sessionSuffix}`
                : `${sessions.length} session${sessionSuffix}`
            })()}
          </span>
        </div>
      </>
    )
  }

  return (
    <div className={`zen-sessions-split ${detailSession ? 'zen-sessions-split-open' : ''}`}>
      <div className="zen-sessions-panel">{listContent}</div>
      {detailSession && (
        <ZenSessionDetailPanel session={detailSession} onClose={() => setDetailSessionKey(null)} />
      )}
    </div>
  )
}

/**
 * Zen Sessions Panel
 * Lists all active sessions with status indicators
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { useSessionActivity } from '@/hooks/useSessionActivity'
import type { CrewSession } from '@/lib/api'

interface ZenSessionsPanelProps {
  selectedSessionKey?: string
  onSelectSession: (sessionKey: string, agentName: string, agentIcon?: string) => void
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
  session: CrewSession
  displayName: string | null
  isActive: boolean
  isSelected: boolean
  onSelect: () => void
}

function SessionItem({ session, displayName, isActive, isSelected, onSelect }: SessionItemProps) {
  const icon = getAgentIcon(session)
  const name = displayName || session.displayName || session.label || session.key.split(':').pop() || 'Agent'
  
  // Determine status
  const status = isActive ? 'active' : 'idle'
  
  return (
    <div
      className={`zen-session-item ${isSelected ? 'zen-session-item-selected' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
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
        <span className={`zen-status-dot zen-status-dot-${status === 'active' ? 'thinking' : 'idle'}`} />
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="zen-sessions-empty">
      <div className="zen-empty-icon">📋</div>
      <div className="zen-empty-title">No sessions</div>
      <div className="zen-empty-subtitle">
        Agent sessions will appear here
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

export function ZenSessionsPanel({ selectedSessionKey, onSelectSession }: ZenSessionsPanelProps) {
  const { sessions, loading, connected } = useSessionsStream(true)
  const { isActivelyRunning } = useSessionActivity(sessions)
  const [focusedIndex, setFocusedIndex] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  
  // Filter & sort sessions - only show chattable sessions
  const sortedSessions = useMemo(() => {
    const now = Date.now()
    const SUBAGENT_MAX_AGE_MS = 30 * 60 * 1000 // 30 minutes
    
    return [...sessions]
      .filter(s => {
        // Main sessions are always chattable
        if (s.key.includes(':main')) return true
        
        // Subagent sessions: only show if recently active
        const age = now - s.updatedAt
        if (age > SUBAGENT_MAX_AGE_MS) return false
        
        return true
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [sessions])
  
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
        setFocusedIndex(prev => Math.min(prev + 1, sortedSessions.length - 1))
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setFocusedIndex(prev => Math.max(prev - 1, 0))
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
  
  const handleSelect = useCallback((session: CrewSession) => {
    onSelectSession(session.key, getDisplayName(session), getAgentIcon(session))
  }, [getDisplayName, onSelectSession])
  
  // Loading state
  if (loading && sessions.length === 0) {
    return (
      <div className="zen-sessions-panel">
        <LoadingState />
      </div>
    )
  }
  
  // Empty state
  if (sessions.length === 0) {
    return (
      <div className="zen-sessions-panel">
        <EmptyState />
      </div>
    )
  }
  
  return (
    <div className="zen-sessions-panel">
      {/* Connection status */}
      {!connected && (
        <div className="zen-sessions-reconnecting">
          <span className="zen-thinking-dots">
            <span />
            <span />
            <span />
          </span>
          Reconnecting...
        </div>
      )}
      
      {/* Sessions list */}
      <div ref={listRef} className="zen-sessions-list" role="listbox" aria-label="Sessions">
        {sortedSessions.map((session, index) => (
          <SessionItem
            key={session.key}
            session={session}
            displayName={getDisplayName(session)}
            isActive={isActivelyRunning(session.key)}
            isSelected={session.key === selectedSessionKey}
            onSelect={() => {
              setFocusedIndex(index)
              handleSelect(session)
            }}
          />
        ))}
      </div>
      
      {/* Footer with count */}
      <div className="zen-sessions-footer">
        <span className="zen-sessions-count">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}

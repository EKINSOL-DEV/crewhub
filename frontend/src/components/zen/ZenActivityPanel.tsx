/**
 * Zen Activity Panel
 * Real-time activity feed showing what agents are doing
 * Shows session labels and status - same as 3D view bubbles
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { sseManager } from '@/lib/sseManager'
import type { CrewSession } from '@/lib/api'
import { useSessionsStream } from '@/hooks/useSessionsStream'
import { useDemoMode } from '@/contexts/DemoContext'
import { splitSessionsForDisplay } from '@/lib/sessionFiltering'
import { getSessionStatus, type SessionStatus } from '@/lib/sessionConfig'

// ── Activity Event Types ──────────────────────────────────────────

interface ActivityEvent {
  id: string
  type: 'activity' | 'started' | 'completed' | 'status'
  timestamp: number
  sessionKey: string
  agentName: string
  activity: string
  icon: string
  status: SessionStatus
  tokens?: number
}

// ── Event Formatting ──────────────────────────────────────────────

function getAgentName(session: CrewSession): string {
  return session.displayName || session.label || session.key?.split(':')[1] || 'Agent'
}

function getAgentIcon(session: CrewSession): string {
  const key = session.key?.toLowerCase() || ''
  const channel = session.channel?.toLowerCase() || ''
  
  if (key.includes('dev')) return '💻'
  if (key.includes('flowy') || key.includes('marketing')) return '📣'
  if (key.includes('reviewer')) return '👀'
  if (key.includes('gamedev')) return '🎮'
  if (key.includes('creator')) return '🎬'
  if (channel.includes('slack')) return '📢'
  if (channel.includes('discord')) return '🎮'
  if (channel.includes('whatsapp')) return '📱'
  if (channel.includes('telegram')) return '✈️'
  
  return '🤖'
}

function formatEventTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: false 
  })
}

function getActivityLabel(session: CrewSession): string {
  // Use label if available
  if (session.label && session.label.length > 0) {
    return session.label
  }
  
  // Fall back to model info
  if (session.model) {
    return `Using ${session.model.split('/').pop()}`
  }
  
  return 'Active'
}

// ── Activity Item Component ───────────────────────────────────────

interface ActivityItemProps {
  event: ActivityEvent
}

function ActivityItem({ event }: ActivityItemProps) {
  const statusColors: Record<SessionStatus, string> = {
    active: 'var(--zen-success)',
    idle: 'var(--zen-warning)',
    sleeping: 'var(--zen-fg-muted)',
  }
  
  const statusLabels: Record<SessionStatus, string> = {
    active: 'ACT',
    idle: 'IDL',
    sleeping: 'SLP',
  }
  
  return (
    <div className={`zen-activity-item zen-activity-${event.status} zen-fade-in`}>
      <div className="zen-activity-time">{formatEventTime(event.timestamp)}</div>
      
      <div 
        className="zen-activity-type" 
        style={{ color: statusColors[event.status] }}
      >
        {statusLabels[event.status]}
      </div>
      
      <div className="zen-activity-icon">{event.icon}</div>
      
      <div className="zen-activity-content">
        <span className="zen-activity-agent">{event.agentName}</span>
        <span className="zen-activity-desc">{event.activity}</span>
        {event.tokens !== undefined && event.tokens > 0 && (
          <span className="zen-activity-details">{event.tokens.toLocaleString()} tokens</span>
        )}
      </div>
    </div>
  )
}

// ── Current Sessions List ─────────────────────────────────────────

interface CurrentSessionItemProps {
  session: CrewSession
}

function CurrentSessionItem({ session }: CurrentSessionItemProps) {
  const status = getSessionStatus(session.updatedAt)
  const statusColors: Record<SessionStatus, string> = {
    active: 'var(--zen-success)',
    idle: 'var(--zen-warning)',
    sleeping: 'var(--zen-fg-muted)',
  }
  
  return (
    <div className={`zen-activity-current-item zen-activity-${status}`}>
      <div 
        className="zen-activity-status-dot"
        style={{ background: statusColors[status] }}
      />
      <span className="zen-activity-icon">{getAgentIcon(session)}</span>
      <div className="zen-activity-current-content">
        <span className="zen-activity-agent">{getAgentName(session)}</span>
        <span className="zen-activity-desc">{getActivityLabel(session)}</span>
      </div>
      {session.totalTokens !== undefined && session.totalTokens > 0 && (
        <span className="zen-activity-tokens">{session.totalTokens.toLocaleString()}</span>
      )}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="zen-activity-empty">
      <div className="zen-empty-icon">⚡</div>
      <div className="zen-empty-title">No active agents</div>
      <div className="zen-empty-subtitle">
        Agent activity will appear here
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

const MAX_EVENTS = 50

export function ZenActivityPanel() {
  const { sessions: realSessions } = useSessionsStream()
  const { isDemoMode, demoSessions } = useDemoMode()
  const sessions = isDemoMode ? demoSessions : realSessions
  
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [viewMode, setViewMode] = useState<'current' | 'history'>('current')
  const listRef = useRef<HTMLDivElement>(null)
  const prevSessionsRef = useRef<Map<string, { label: string; tokens: number }>>(new Map())
  
  // Get active/idle sessions (not sleeping)
  const { visible } = useMemo(() => splitSessionsForDisplay(sessions), [sessions])
  const activeSessions = useMemo(() => 
    visible.filter(s => getSessionStatus(s.updatedAt) !== 'sleeping'),
    [visible]
  )
  
  // Track session changes and add to history
  useEffect(() => {
    const genId = () => `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = Date.now()
    const newEvents: ActivityEvent[] = []
    
    for (const session of sessions) {
      const prev = prevSessionsRef.current.get(session.key)
      const status = getSessionStatus(session.updatedAt)
      
      // Only track active sessions
      if (status === 'sleeping') continue
      
      // New session or label changed
      if (!prev || prev.label !== session.label) {
        newEvents.push({
          id: genId(),
          type: prev ? 'activity' : 'started',
          timestamp: now,
          sessionKey: session.key,
          agentName: getAgentName(session),
          activity: getActivityLabel(session),
          icon: getAgentIcon(session),
          status,
          tokens: session.totalTokens,
        })
      }
      
      // Update tracking
      prevSessionsRef.current.set(session.key, {
        label: session.label || '',
        tokens: session.totalTokens || 0,
      })
    }
    
    if (newEvents.length > 0) {
      setEvents(prev => [...newEvents, ...prev].slice(0, MAX_EVENTS))
    }
  }, [sessions])
  
  // Subscribe to SSE connection state
  useEffect(() => {
    const unsubscribe = sseManager.onStateChange((state) => {
      setConnected(state === 'connected')
    })
    return unsubscribe
  }, [])
  
  // Clear history
  const handleClear = useCallback(() => {
    setEvents([])
  }, [])
  
  return (
    <div className="zen-activity-panel">
      {/* Header with controls */}
      <div className="zen-activity-header">
        <div className="zen-activity-status">
          <span className={`zen-status-dot ${connected ? 'zen-status-dot-active' : 'zen-status-dot-error'}`} />
          <span>{connected ? 'Live' : 'Connecting...'}</span>
        </div>
        
        <div className="zen-activity-tabs">
          <button
            type="button"
            className={`zen-activity-tab ${viewMode === 'current' ? 'zen-activity-tab-active' : ''}`}
            onClick={() => setViewMode('current')}
          >
            Current
          </button>
          <button
            type="button"
            className={`zen-activity-tab ${viewMode === 'history' ? 'zen-activity-tab-active' : ''}`}
            onClick={() => setViewMode('history')}
          >
            History
          </button>
        </div>
        
        {viewMode === 'history' && events.length > 0 && (
          <button
            type="button"
            className="zen-btn zen-btn-small"
            onClick={handleClear}
            title="Clear history"
          >
            Clear
          </button>
        )}
      </div>
      
      {/* Current view - active sessions */}
      {viewMode === 'current' && (
        activeSessions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="zen-activity-current-list">
            {activeSessions.map(session => (
              <CurrentSessionItem key={session.key} session={session} />
            ))}
          </div>
        )
      )}
      
      {/* History view - event log */}
      {viewMode === 'history' && (
        events.length === 0 ? (
          <div className="zen-activity-empty">
            <div className="zen-empty-icon">📜</div>
            <div className="zen-empty-title">No history yet</div>
            <div className="zen-empty-subtitle">
              Activity changes will be logged here
            </div>
          </div>
        ) : (
          <div ref={listRef} className="zen-activity-list">
            {events.map(event => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </div>
        )
      )}
      
      {/* Footer with count */}
      <div className="zen-activity-footer">
        <span className="zen-activity-count">
          {viewMode === 'current' 
            ? `${activeSessions.length} active`
            : `${events.length} event${events.length !== 1 ? 's' : ''}`
          }
        </span>
      </div>
    </div>
  )
}

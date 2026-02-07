/**
 * Zen Activity Panel
 * Real-time SSE activity feed showing session events
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { sseManager } from '@/lib/sseManager'
import type { CrewSession } from '@/lib/api'

// ── Activity Event Types ──────────────────────────────────────────

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

// ── Event Formatting ──────────────────────────────────────────────

function getAgentName(session: Partial<CrewSession>): string {
  return session.displayName || session.label || session.key?.split(':').pop() || 'Agent'
}

function getSessionIcon(session: Partial<CrewSession>): string {
  const kind = session.kind?.toLowerCase() || ''
  const channel = session.channel?.toLowerCase() || ''
  
  if (kind.includes('dev') || kind.includes('code')) return '💻'
  if (kind.includes('chat')) return '💬'
  if (kind.includes('task')) return '📋'
  if (channel.includes('slack')) return '📢'
  if (channel.includes('discord')) return '🎮'
  if (channel.includes('whatsapp')) return '📱'
  
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

// Unused but kept for future use
// function formatRelativeTime(timestamp: number): string {
//   const diff = Date.now() - timestamp
//   if (diff < 60000) return 'just now'
//   if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
//   return formatEventTime(timestamp)
// }

// ── Activity Item Component ───────────────────────────────────────

interface ActivityItemProps {
  event: ActivityEvent
}

function ActivityItem({ event }: ActivityItemProps) {
  const typeColors: Record<string, string> = {
    created: 'var(--zen-success)',
    updated: 'var(--zen-info)',
    removed: 'var(--zen-error)',
    status: 'var(--zen-warning)',
  }
  
  const typeLabels: Record<string, string> = {
    created: 'NEW',
    updated: 'UPD',
    removed: 'DEL',
    status: 'STS',
  }
  
  return (
    <div className="zen-activity-item zen-fade-in">
      <div className="zen-activity-time">{formatEventTime(event.timestamp)}</div>
      
      <div 
        className="zen-activity-type" 
        style={{ color: typeColors[event.type] || 'var(--zen-fg-muted)' }}
      >
        {typeLabels[event.type] || event.type.toUpperCase().slice(0, 3)}
      </div>
      
      <div className="zen-activity-icon">{event.icon}</div>
      
      <div className="zen-activity-content">
        <span className="zen-activity-agent">{event.sessionName}</span>
        <span className="zen-activity-desc">{event.description}</span>
        {event.details && (
          <span className="zen-activity-details">{event.details}</span>
        )}
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="zen-activity-empty">
      <div className="zen-empty-icon">⚡</div>
      <div className="zen-empty-title">No activity yet</div>
      <div className="zen-empty-subtitle">
        Real-time events will appear here
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

const MAX_EVENTS = 100
const BATCH_DELAY_MS = 100

export function ZenActivityPanel() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const batchedEventsRef = useRef<ActivityEvent[]>([])
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Flush batched events to state
  const flushBatch = useCallback(() => {
    if (batchedEventsRef.current.length === 0) return
    
    const newEvents = [...batchedEventsRef.current]
    batchedEventsRef.current = []
    
    setEvents(prev => {
      const combined = [...newEvents, ...prev]
      return combined.slice(0, MAX_EVENTS)
    })
  }, [])
  
  // Add event to batch (with 100ms debounce)
  const addEvent = useCallback((event: ActivityEvent) => {
    batchedEventsRef.current.push(event)
    
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current)
    }
    
    batchTimeoutRef.current = setTimeout(flushBatch, BATCH_DELAY_MS)
  }, [flushBatch])
  
  // Subscribe to SSE events
  useEffect(() => {
    // Use timestamp + random for unique IDs
    const genId = () => `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    
    // Connection state
    const unsubscribeState = sseManager.onStateChange((state) => {
      setConnected(state === 'connected')
      
      if (state === 'connected') {
        addEvent({
          id: genId(),
          type: 'status',
          timestamp: Date.now(),
          sessionKey: '',
          sessionName: 'System',
          description: 'Connected to activity stream',
          icon: '🟢',
        })
      } else if (state === 'disconnected') {
        addEvent({
          id: genId(),
          type: 'status',
          timestamp: Date.now(),
          sessionKey: '',
          sessionName: 'System',
          description: 'Disconnected - reconnecting...',
          icon: '🟡',
        })
      }
    })
    
    // Session created
    const handleCreated = (e: MessageEvent) => {
      try {
        const session: CrewSession = JSON.parse(e.data)
        addEvent({
          id: genId(),
          type: 'created',
          timestamp: Date.now(),
          sessionKey: session.key,
          sessionName: getAgentName(session),
          description: 'Session started',
          icon: getSessionIcon(session),
          details: session.channel ? `via ${session.channel}` : undefined,
        })
      } catch {
        // Ignore parse errors
      }
    }
    
    // Session updated
    const handleUpdated = (e: MessageEvent) => {
      try {
        const session: CrewSession = JSON.parse(e.data)
        const tokens = session.totalTokens || 0
        addEvent({
          id: genId(),
          type: 'updated',
          timestamp: Date.now(),
          sessionKey: session.key,
          sessionName: getAgentName(session),
          description: 'Activity',
          icon: getSessionIcon(session),
          details: tokens > 0 ? `${tokens.toLocaleString()} tokens` : undefined,
        })
      } catch {
        // Ignore parse errors
      }
    }
    
    // Session removed
    const handleRemoved = (e: MessageEvent) => {
      try {
        const { key } = JSON.parse(e.data)
        addEvent({
          id: genId(),
          type: 'removed',
          timestamp: Date.now(),
          sessionKey: key,
          sessionName: key.split(':').pop() || 'Agent',
          description: 'Session ended',
          icon: '🔴',
        })
      } catch {
        // Ignore parse errors
      }
    }
    
    const unsubCreated = sseManager.subscribe('session-created', handleCreated)
    const unsubUpdated = sseManager.subscribe('session-updated', handleUpdated)
    const unsubRemoved = sseManager.subscribe('session-removed', handleRemoved)
    
    return () => {
      unsubscribeState()
      unsubCreated()
      unsubUpdated()
      unsubRemoved()
      
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
      }
    }
  }, [addEvent])
  
  // Auto-scroll when new events arrive
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0 // Events are prepended, so scroll to top
    }
  }, [events, autoScroll])
  
  // Detect when user scrolls away from top
  const handleScroll = useCallback(() => {
    const list = listRef.current
    if (!list) return
    
    const isAtTop = list.scrollTop < 50
    setAutoScroll(isAtTop)
  }, [])
  
  // Clear events
  const handleClear = useCallback(() => {
    setEvents([])
    batchedEventsRef.current = []
  }, [])
  
  return (
    <div className="zen-activity-panel">
      {/* Header with controls */}
      <div className="zen-activity-header">
        <div className="zen-activity-status">
          <span className={`zen-status-dot ${connected ? 'zen-status-dot-active' : 'zen-status-dot-error'}`} />
          <span>{connected ? 'Live' : 'Connecting...'}</span>
        </div>
        
        <div className="zen-activity-controls">
          {!autoScroll && events.length > 0 && (
            <button
              className="zen-btn zen-btn-small"
              onClick={() => {
                setAutoScroll(true)
                if (listRef.current) listRef.current.scrollTop = 0
              }}
            >
              ↑ New events
            </button>
          )}
          
          {events.length > 0 && (
            <button
              className="zen-btn zen-btn-small"
              onClick={handleClear}
              title="Clear activity"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      {/* Events list */}
      {events.length === 0 ? (
        <EmptyState />
      ) : (
        <div 
          ref={listRef}
          className="zen-activity-list"
          onScroll={handleScroll}
        >
          {events.map(event => (
            <ActivityItem key={event.id} event={event} />
          ))}
        </div>
      )}
      
      {/* Footer with count */}
      <div className="zen-activity-footer">
        <span className="zen-activity-count">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

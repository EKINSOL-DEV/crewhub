/**
 * Zen Mode Status Bar
 * Bottom bar showing agent status, room, and keyboard hints
 */

import { useState, useEffect } from 'react'

interface ZenStatusBarProps {
  agentName: string | null
  agentStatus: 'active' | 'thinking' | 'idle' | 'error'
  roomName?: string
  connected: boolean
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  })
}

export function ZenStatusBar({ 
  agentName, 
  agentStatus, 
  roomName,
  connected 
}: ZenStatusBarProps) {
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()))

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(formatTime(new Date()))
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  const getStatusDotClass = () => {
    switch (agentStatus) {
      case 'active': return 'zen-status-dot zen-status-dot-active'
      case 'thinking': return 'zen-status-dot zen-status-dot-thinking'
      case 'error': return 'zen-status-dot zen-status-dot-error'
      default: return 'zen-status-dot zen-status-dot-idle'
    }
  }

  const getStatusLabel = () => {
    switch (agentStatus) {
      case 'active': return 'Active'
      case 'thinking': return 'Thinking...'
      case 'error': return 'Error'
      default: return 'Idle'
    }
  }

  return (
    <footer className="zen-status-bar">
      <div className="zen-status-bar-left">
        {agentName ? (
          <div className="zen-status-item">
            <span className={getStatusDotClass()} />
            <span>{agentName}</span>
            <span style={{ color: 'var(--zen-fg-dim)' }}>•</span>
            <span style={{ color: 'var(--zen-fg-muted)' }}>{getStatusLabel()}</span>
          </div>
        ) : (
          <div className="zen-status-item" style={{ color: 'var(--zen-fg-muted)' }}>
            No agent selected
          </div>
        )}
      </div>

      <div className="zen-status-bar-center">
        {roomName ? (
          <span>{roomName}</span>
        ) : (
          <span>—</span>
        )}
      </div>

      <div className="zen-status-bar-right">
        <div className="zen-status-item">
          <span className={`zen-status-dot ${connected ? 'zen-status-dot-active' : 'zen-status-dot-error'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <span style={{ color: 'var(--zen-fg-dim)' }}>•</span>
        <span>{currentTime}</span>
        <span style={{ color: 'var(--zen-fg-dim)' }}>•</span>
        <span>
          <kbd className="zen-kbd">Esc</kbd> to exit
        </span>
      </div>
    </footer>
  )
}

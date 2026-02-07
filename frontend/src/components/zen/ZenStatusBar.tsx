/**
 * Zen Mode Status Bar
 * Bottom bar showing agent status, room, panel info, theme, and connection status
 */

import { useState, useEffect } from 'react'

interface ZenStatusBarProps {
  agentName: string | null
  agentStatus: 'active' | 'thinking' | 'idle' | 'error'
  roomName?: string
  connected: boolean
  panelCount?: number
  focusedPanelIndex?: number
  themeName?: string
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
  connected,
  panelCount = 1,
  focusedPanelIndex = 1,
  themeName,
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
            <span className="zen-status-sep">•</span>
            <span className="zen-status-muted">{getStatusLabel()}</span>
          </div>
        ) : (
          <div className="zen-status-item zen-status-muted">
            Select a session to start chatting
          </div>
        )}
      </div>

      <div className="zen-status-bar-center">
        <div className="zen-status-item">
          {roomName && (
            <>
              <span className="zen-status-room">{roomName}</span>
              <span className="zen-status-sep">•</span>
            </>
          )}
          <span className="zen-status-panels">
            Panel {focusedPanelIndex}/{panelCount}
          </span>
          {themeName && (
            <>
              <span className="zen-status-sep">•</span>
              <span className="zen-status-theme" title="Current theme">
                <span className="zen-status-theme-icon">🎨</span>
                {themeName}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="zen-status-bar-right">
        <div className="zen-status-item">
          <span className={`zen-status-dot ${connected ? 'zen-status-dot-active' : 'zen-status-dot-error'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        <span className="zen-status-sep">•</span>
        <span className="zen-status-time">{currentTime}</span>
      </div>
    </footer>
  )
}

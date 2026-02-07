/**
 * Zen Mode - Full-screen focused workspace
 * A tmux-inspired interface for distraction-free agent interaction
 */

import { useState, useEffect, useCallback } from 'react'
import { ZenTopBar } from './ZenTopBar'
import { ZenStatusBar } from './ZenStatusBar'
import { ZenChatPanel } from './ZenChatPanel'
import { tokyoNight, themeToCSSVariables } from './themes/tokyo-night'
import './ZenMode.css'

interface ZenModeProps {
  sessionKey: string | null
  agentName: string | null
  agentIcon: string | null
  agentColor: string | null
  roomName?: string
  connected: boolean
  onExit: () => void
}

export function ZenMode({
  sessionKey,
  agentName,
  agentIcon,
  agentColor: _agentColor, // Reserved for future theme accent customization
  roomName,
  connected,
  onExit,
}: ZenModeProps) {
  const [agentStatus, setAgentStatus] = useState<'active' | 'thinking' | 'idle' | 'error'>('idle')

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement
    const vars = themeToCSSVariables(tokyoNight)
    
    // Store original values to restore on unmount
    const originalValues: Record<string, string> = {}
    
    Object.entries(vars).forEach(([key, value]) => {
      originalValues[key] = root.style.getPropertyValue(key)
      root.style.setProperty(key, value)
    })

    // Set theme attribute for additional styling
    root.setAttribute('data-zen-theme', tokyoNight.id)

    return () => {
      // Restore original values
      Object.entries(originalValues).forEach(([key, value]) => {
        if (value) {
          root.style.setProperty(key, value)
        } else {
          root.style.removeProperty(key)
        }
      })
      root.removeAttribute('data-zen-theme')
    }
  }, [])

  // Handle escape key to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onExit()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onExit])

  // Lock body scroll when Zen Mode is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  const handleStatusChange = useCallback((status: 'active' | 'thinking' | 'idle' | 'error') => {
    setAgentStatus(status)
  }, [])

  return (
    <div 
      className="zen-mode zen-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="Zen Mode - Focused workspace"
    >
      <ZenTopBar onExit={onExit} />
      
      <main className="zen-main">
        <ZenChatPanel
          sessionKey={sessionKey}
          agentName={agentName}
          agentIcon={agentIcon}
          onStatusChange={handleStatusChange}
        />
      </main>
      
      <ZenStatusBar
        agentName={agentName}
        agentStatus={agentStatus}
        roomName={roomName}
        connected={connected}
      />
    </div>
  )
}

// ── Zen Mode Entry Button ──────────────────────────────────────

interface ZenModeButtonProps {
  onClick: () => void
}

export function ZenModeButton({ onClick }: ZenModeButtonProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 12px',
        borderRadius: '8px',
        border: 'none',
        background: isHovered ? 'rgba(122, 162, 247, 0.2)' : 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        color: isHovered ? '#7aa2f7' : 'rgba(255, 255, 255, 0.8)',
        fontSize: '13px',
        fontWeight: 500,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      }}
      title="Enter Zen Mode (Ctrl+Shift+Z)"
    >
      <span style={{ fontSize: '16px' }}>🧘</span>
      <span>Zen</span>
      {isHovered && (
        <span 
          style={{ 
            fontSize: '10px', 
            opacity: 0.7,
            padding: '2px 4px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
          }}
        >
          Ctrl+Shift+Z
        </span>
      )}
    </button>
  )
}

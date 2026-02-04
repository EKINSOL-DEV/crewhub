import { useState } from 'react'
import { useChatContext } from '@/contexts/ChatContext'
import { AgentChatWindow } from './AgentChatWindow'

/**
 * ChatWindowManager
 * 
 * Renders:
 * 1. All open (non-minimized) chat windows as draggable/resizable panels
 * 2. A vertical minimized-chat bar on the LEFT edge of the screen
 */
export function ChatWindowManager() {
  const { windows, restoreChat, closeChat } = useChatContext()

  const openWindows = windows.filter(w => !w.isMinimized)
  const minimizedWindows = windows.filter(w => w.isMinimized)

  return (
    <>
      {/* ── Open chat windows ── */}
      {openWindows.map(w => (
        <AgentChatWindow
          key={w.sessionKey}
          sessionKey={w.sessionKey}
          agentName={w.agentName}
          agentIcon={w.agentIcon}
          agentColor={w.agentColor}
          position={w.position}
          size={w.size}
          zIndex={w.zIndex}
        />
      ))}

      {/* ── Left-side minimized bar ── */}
      {minimizedWindows.length > 0 && (
        <MinimizedBar
          windows={minimizedWindows}
          onRestore={restoreChat}
          onClose={closeChat}
        />
      )}

      {/* Global styles for chat windows */}
      <style>{chatStyles}</style>
    </>
  )
}

// ── Minimized Bar on LEFT edge ─────────────────────────────────

interface MinimizedBarProps {
  windows: Array<{
    sessionKey: string
    agentName: string
    agentIcon: string | null
    agentColor: string | null
  }>
  onRestore: (sessionKey: string) => void
  onClose: (sessionKey: string) => void
}

function MinimizedBar({ windows, onRestore, onClose }: MinimizedBarProps) {
  return (
    <div
      style={{
        position: 'fixed',
        left: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 999,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 4px',
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 14,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}
    >
      {windows.map(w => (
        <MinimizedPill
          key={w.sessionKey}
          sessionKey={w.sessionKey}
          name={w.agentName}
          icon={w.agentIcon || '🤖'}
          color={w.agentColor || '#8b5cf6'}
          onRestore={onRestore}
          onClose={onClose}
        />
      ))}
    </div>
  )
}

// ── Minimized Pill ─────────────────────────────────────────────

function MinimizedPill({
  sessionKey,
  name,
  icon,
  color,
  onRestore,
  onClose,
}: {
  sessionKey: string
  name: string
  icon: string
  color: string
  onRestore: (key: string) => void
  onClose: (key: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Pill button */}
      <button
        onClick={() => onRestore(sessionKey)}
        title={`Open ${name}`}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          border: `2px solid ${color}40`,
          background: `${color}18`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          transition: 'all 0.2s',
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          boxShadow: hovered ? `0 2px 10px ${color}30` : 'none',
        }}
      >
        {icon}
      </button>

      {/* Expanded tooltip on hover */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: 48,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            borderRadius: 10,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            animation: 'chatPillSlideIn 0.15s ease-out',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#1f2937',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            {name}
          </span>
          <button
            onClick={e => {
              e.stopPropagation()
              onClose(sessionKey)
            }}
            title="Close"
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              border: 'none',
              background: 'rgba(0,0,0,0.06)',
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

// ── Global chat styles ─────────────────────────────────────────

const chatStyles = `
  @keyframes chatPillSlideIn {
    from {
      opacity: 0;
      transform: translateY(-50%) translateX(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(-50%) translateX(0);
    }
  }

  .chat-thinking-pulse {
    animation: chatThinkingPulse 1s ease-in-out infinite;
  }

  @keyframes chatThinkingPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }

  .chat-window-container {
    /* Ensure the Rnd container has rounded corners */
  }
`

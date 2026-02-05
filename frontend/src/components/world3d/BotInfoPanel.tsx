import { useEffect, useRef } from 'react'
import type { CrewSession } from '@/lib/api'
import type { BotVariantConfig } from './utils/botVariants'
import type { BotStatus } from './Bot3D'
import { useChatContext } from '@/contexts/ChatContext'

interface BotInfoPanelProps {
  session: CrewSession | null
  displayName: string
  botConfig: BotVariantConfig
  status: BotStatus
  bio?: string | null
  onClose: () => void
  onOpenLog: (session: CrewSession) => void
}

// ── Helpers ────────────────────────────────────────────────────

const FIXED_AGENT_RE = /^agent:[a-zA-Z0-9_-]+:main$/

function isFixedAgent(key: string): boolean {
  return FIXED_AGENT_RE.test(key)
}

function formatTimeSince(updatedAt: number): string {
  const seconds = Math.floor((Date.now() - updatedAt) / 1000)
  if (seconds < 30) return 'Active now'
  if (seconds < 60) return `Idle ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Idle ${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `Idle ${hours}h ${minutes % 60}m`
}

function formatModel(model?: string): string {
  if (!model) return 'Unknown'
  if (model.includes('sonnet')) return 'Sonnet'
  if (model.includes('opus')) return 'Opus'
  if (model.includes('haiku')) return 'Haiku'
  if (model.includes('gpt-4o')) return 'GPT-4o'
  if (model.includes('gpt-4')) return 'GPT-4'
  if (model.includes('gpt-5')) return 'GPT-5'
  const parts = model.split('/')
  return parts[parts.length - 1].slice(0, 24)
}

function formatTokens(tokens?: number): string {
  if (!tokens) return '—'
  if (tokens < 1000) return `${tokens}`
  if (tokens < 1_000_000) return `${(tokens / 1000).toFixed(1)}k`
  return `${(tokens / 1_000_000).toFixed(2)}M`
}

function getStatusBadge(status: BotStatus): { label: string; color: string; bg: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#15803d', bg: '#dcfce7' }
    case 'idle':
      return { label: 'Idle', color: '#a16207', bg: '#fef9c3' }
    case 'sleeping':
      return { label: 'Sleeping', color: '#6b7280', bg: '#f3f4f6' }
    case 'offline':
      return { label: 'Offline', color: '#991b1b', bg: '#fecaca' }
  }
}

function getLastAssistantMessage(session: CrewSession): string | null {
  if (!session.messages || session.messages.length === 0) return null
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i]
    if (msg.role === 'assistant' && msg.content) {
      for (const block of msg.content) {
        if (block.text) return block.text.slice(0, 120)
      }
    }
  }
  return null
}

// ── Component ──────────────────────────────────────────────────

export function BotInfoPanel({ session, displayName, botConfig, status, bio, onClose, onOpenLog }: BotInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const canChat = session ? isFixedAgent(session.key) : false
  const { openChat } = useChatContext()

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setTimeout(() => onClose(), 50)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
    }, 200)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  if (!session) return null

  const statusBadge = getStatusBadge(status)
  const lastMessage = getLastAssistantMessage(session)

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 80,
        width: 320,
        zIndex: 60,
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 16,
        border: '1px solid rgba(0, 0, 0, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'botPanelSlideIn 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}>
        {/* Bot icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: botConfig.color + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          flexShrink: 0,
        }}>
          {botConfig.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#1f2937',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {displayName || session.key.split(':')[1] || session.key}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 8,
              fontSize: 11,
              fontWeight: 600,
              color: statusBadge.color,
              background: statusBadge.bg,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: statusBadge.color,
                display: 'inline-block',
              }} />
              {statusBadge.label}
            </span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            border: 'none',
            background: 'rgba(0, 0, 0, 0.05)',
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)' }}
        >
          ✕
        </button>
      </div>

      {/* Separator */}
      <div style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', margin: '16px 0 0' }} />

      {/* Info Body */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}>
        {/* Bio */}
        {bio && (
          <div style={{
            fontSize: 13,
            color: '#6b7280',
            lineHeight: 1.5,
            fontStyle: 'italic',
            padding: '8px 12px',
            background: `${botConfig.color}08`,
            borderRadius: 10,
            borderLeft: `3px solid ${botConfig.color}40`,
          }}>
            {bio}
          </div>
        )}

        <InfoRow label="Type">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: botConfig.color,
              display: 'inline-block',
            }} />
            {botConfig.label}
          </span>
        </InfoRow>

        <InfoRow label="Status">
          {formatTimeSince(session.updatedAt)}
        </InfoRow>

        <InfoRow label="Model">
          {formatModel(session.model)}
        </InfoRow>

        <InfoRow label="Tokens">
          {formatTokens(session.totalTokens)}
        </InfoRow>

        {session.lastChannel && (
          <InfoRow label="Channel">
            {session.lastChannel}
          </InfoRow>
        )}

        {lastMessage && (
          <div>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#9ca3af',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
              marginBottom: 6,
            }}>
              Last message
            </div>
            <div style={{
              fontSize: 13,
              color: '#4b5563',
              lineHeight: 1.5,
              background: 'rgba(0, 0, 0, 0.03)',
              padding: '10px 12px',
              borderRadius: 10,
              fontStyle: 'italic',
              wordBreak: 'break-word',
            }}>
              {lastMessage}
              {lastMessage.length >= 120 && '…'}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 20px 16px',
        borderTop: '1px solid rgba(0, 0, 0, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {canChat && (
          <button
            onClick={() => openChat(session.key, displayName, botConfig.icon, botConfig.color)}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: botConfig.color + 'dd',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'system-ui, sans-serif',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            💬 Open Chat
          </button>
        )}
        <button
          onClick={() => onOpenLog(session)}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: canChat ? 'rgba(0, 0, 0, 0.05)' : botConfig.color + 'dd',
            color: canChat ? '#374151' : '#fff',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
        >
          📋 Open Full Log
        </button>
      </div>

      {/* Slide-in animation */}
      <style>{`
        @keyframes botPanelSlideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Reusable row ───────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <span style={{
        fontSize: 13,
        color: '#9ca3af',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 13,
        color: '#374151',
        fontWeight: 600,
      }}>
        {children}
      </span>
    </div>
  )
}

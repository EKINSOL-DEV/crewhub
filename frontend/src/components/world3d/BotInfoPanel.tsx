import { useEffect, useRef, memo } from 'react'
import type { CrewSession } from '@/lib/api'
import type { BotVariantConfig } from './utils/botVariants'
import type { BotStatus } from './botConstants'
import { BotInfoTabs } from './BotInfoTabs'

interface BotInfoPanelProps {
  readonly session: CrewSession | null
  readonly displayName: string
  readonly botConfig: BotVariantConfig
  readonly status: BotStatus
  readonly bio?: string | null
  readonly agentId?: string | null
  readonly currentRoomId?: string | null
  readonly onClose: () => void
  readonly onOpenLog: (session: CrewSession) => void
  readonly onAssignmentChanged?: () => void
  readonly onBioUpdated?: () => void
}

// ── Helpers ────────────────────────────────────────────────────

const FIXED_AGENT_RE = /^(agent:[a-zA-Z0-9_-]+:main|cc:[a-zA-Z0-9_-]+)$/

function isFixedAgent(key: string): boolean {
  return FIXED_AGENT_RE.test(key)
}

function getStatusBadge(status: BotStatus): { label: string; color: string; bg: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', color: '#15803d', bg: '#dcfce7' }
    case 'idle':
      return { label: 'Idle', color: '#a16207', bg: '#fef9c3' }
    case 'supervising':
      return { label: 'Supervising', color: '#7c3aed', bg: '#ede9fe' }
    case 'sleeping':
      return { label: 'Sleeping', color: '#6b7280', bg: '#f3f4f6' }
    case 'meeting':
      return { label: 'In Meeting', color: '#0369a1', bg: '#e0f2fe' }
    case 'offline':
      return { label: 'Offline', color: '#991b1b', bg: '#fecaca' }
  }
}

// ── Component ──────────────────────────────────────────────────

export const BotInfoPanel = memo(function BotInfoPanel({
  session,
  displayName,
  botConfig,
  status,
  bio,
  agentId,
  currentRoomId,
  onClose,
  onOpenLog,
  onAssignmentChanged,
  onBioUpdated,
}: BotInfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const canChat = session ? isFixedAgent(session.key) : false

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement
      if (panelRef.current && !panelRef.current.contains(target as Node)) {
        // Don't close when clicking on the 3D canvas (camera rotation/pan starts with mousedown)
        // or on 3D world UI overlays (e.g. Focus Board button rendered via drei Html)
        if (target.closest?.('canvas') || target.tagName === 'CANVAS') return
        if (target.closest?.('[data-world-ui]')) return
        setTimeout(() => onClose(), 50)
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick)
      document.addEventListener('touchstart', handleClick)
    }, 200)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick)
    }
  }, [onClose])

  if (!session) return null

  const statusBadge = getStatusBadge(status)

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 80,
        width: 320,
        zIndex: 25,
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
      <div
        style={{
          padding: '20px 20px 0',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        {/* Bot icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: botConfig.color + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            flexShrink: 0,
          }}
        >
          {botConfig.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#1f2937',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName || session.key.split(':')[1] || session.key}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 600,
                color: statusBadge.color,
                background: statusBadge.bg,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: statusBadge.color,
                  display: 'inline-block',
                }}
              />
              {statusBadge.label}
            </span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          onTouchEnd={(e) => {
            e.preventDefault()
            onClose()
          }}
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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'
          }}
        >
          ✕
        </button>
      </div>

      {/* Separator */}
      <div style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)', margin: '16px 0 0' }} />

      {/* Tabbed Content */}
      <BotInfoTabs
        session={session}
        displayName={displayName}
        botConfig={botConfig}
        status={status}
        bio={bio}
        agentId={agentId}
        currentRoomId={currentRoomId}
        canChat={canChat}
        onOpenLog={onOpenLog}
        onAssignmentChanged={onAssignmentChanged}
        onBioUpdated={onBioUpdated}
      />

      {/* Slide-in animation */}
      <style>{`
        @keyframes botPanelSlideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
})

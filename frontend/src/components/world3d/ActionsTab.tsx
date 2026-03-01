import { useState } from 'react'
import type { CrewSession } from '@/lib/api'
import { API_BASE } from '@/lib/api'
import type { BotVariantConfig } from './utils/botVariants'
import { useChatContext } from '@/contexts/ChatContext'
import { useRooms } from '@/hooks/useRooms'
import { useDemoMode } from '@/contexts/DemoContext'

interface ActionsTabProps {
  readonly session: CrewSession
  readonly displayName: string
  readonly botConfig: BotVariantConfig
  readonly currentRoomId?: string | null
  readonly canChat: boolean
  readonly onOpenLog: (session: CrewSession) => void
  readonly onAssignmentChanged?: () => void
}

const FONT_FAMILY = 'system-ui, sans-serif'

export function ActionsTab({
  session,
  displayName,
  botConfig,
  currentRoomId,
  canChat,
  onOpenLog,
  onAssignmentChanged,
}: ActionsTabProps) {
  const { openChat } = useChatContext()
  const { rooms, refresh: refreshRooms } = useRooms()
  const { isDemoMode } = useDemoMode()
  const [isMoving, setIsMoving] = useState(false)
  const [moveError, setMoveError] = useState<string | null>(null)
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [agentName, setAgentName] = useState('')
  const [isAddingAgent, setIsAddingAgent] = useState(false)
  const [addAgentError, setAddAgentError] = useState<string | null>(null)

  const handleMoveToRoom = async (targetRoomId: string) => {
    if (!session || isDemoMode) return
    setIsMoving(true)
    setMoveError(null)
    try {
      if (targetRoomId === 'parking') {
        const response = await fetch(
          `${API_BASE}/session-room-assignments/${encodeURIComponent(session.key)}`,
          { method: 'DELETE' }
        )
        if (!response.ok && response.status !== 404) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to unassign bot')
        }
      } else {
        const response = await fetch(`${API_BASE}/session-room-assignments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_key: session.key, room_id: targetRoomId }),
        })
        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error(err.detail || 'Failed to move bot')
        }
      }
      await refreshRooms()
      onAssignmentChanged?.()
    } catch (err) {
      console.error('Failed to move bot:', err)
      setMoveError(err instanceof Error ? err.message : 'Failed to move bot')
      setTimeout(() => setMoveError(null), 3000)
    } finally {
      setIsMoving(false)
    }
  }

  const sectionLabel = (text: string) => (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#9ca3af',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        marginBottom: 6,
      }}
    >
      {text}
    </div>
  )

  const actionButton = (
    label: string,
    onClick: () => void,
    opts?: { primary?: boolean; disabled?: boolean }
  ) => (
    <button
      onClick={onClick}
      disabled={opts?.disabled}
      style={{
        width: '100%',
        padding: '10px 16px',
        borderRadius: 10,
        border: 'none',
        background: opts?.primary ? botConfig.color + 'dd' : 'rgba(0, 0, 0, 0.05)',
        color: opts?.primary ? '#fff' : '#374151',
        cursor: opts?.disabled ? 'not-allowed' : 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: FONT_FAMILY,
        transition: 'opacity 0.15s',
        opacity: opts?.disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!opts?.disabled) e.currentTarget.style.opacity = '0.85'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = opts?.disabled ? '0.5' : '1'
      }}
    >
      {label}
    </button>
  )

  const handleAddAsAgent = async () => {
    if (!agentName.trim()) return
    setIsAddingAgent(true)
    setAddAgentError(null)
    try {
      const slug = agentName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9_-]/g, '')
      const sessionId = session.key.replace('claude:', '')
      const response = await fetch(`${API_BASE}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: slug,
          name: agentName.trim(),
          source: 'claude_code',
          agent_session_key: `cc:${slug}`,
          project_path: session.projectPath || null,
          initial_session_id: sessionId,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.detail || 'Failed to create agent')
      }
      setShowAddAgent(false)
      setAgentName('')
    } catch (err) {
      setAddAgentError(err instanceof Error ? err.message : 'Failed to create agent')
      setTimeout(() => setAddAgentError(null), 4000)
    } finally {
      setIsAddingAgent(false)
    }
  }

  let selectCursor: string
  if (isDemoMode) {
    selectCursor = 'not-allowed'
  } else if (isMoving) {
    selectCursor = 'wait'
  } else {
    selectCursor = 'pointer'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Room Management */}
      <div>
        {sectionLabel('Room Management')}
        <div style={{ position: 'relative' }}>
          <select
            value={currentRoomId || 'parking'}
            onChange={(e) => handleMoveToRoom(e.target.value)}
            disabled={isDemoMode || isMoving}
            style={{
              width: '100%',
              padding: '8px 32px 8px 10px',
              fontSize: 13,
              fontWeight: 500,
              color: isDemoMode ? '#9ca3af' : '#374151',
              background: isDemoMode ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              borderRadius: 8,
              cursor: selectCursor,
              appearance: 'none',
              WebkitAppearance: 'none',
              fontFamily: FONT_FAMILY,
              outline: 'none',
            }}
          >
            <option value="parking">🅿️ Parking (unassigned)</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.icon || '📦'} {room.name}
              </option>
            ))}
          </select>
          <div
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              fontSize: 10,
              color: '#9ca3af',
            }}
          >
            {isMoving ? '⏳' : '▼'}
          </div>
        </div>
        {moveError && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#dc2626', fontWeight: 500 }}>
            {moveError}
          </div>
        )}
        {isDemoMode && (
          <div style={{ marginTop: 4, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
            Disabled in demo mode
          </div>
        )}
      </div>

      {/* Communication */}
      <div>
        {sectionLabel('Communication')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {canChat &&
            actionButton(
              '💬 Open Chat',
              () =>
                openChat(session.key, displayName, botConfig.icon, botConfig.color, session.kind),
              { primary: true }
            )}
          {actionButton('📋 Open Full Log', () => onOpenLog(session), { primary: !canChat })}
        </div>
      </div>

      {/* Agent Control */}
      <div>
        {sectionLabel('Agent Control')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {session.key.startsWith('claude:') &&
            session.kind !== 'subagent' &&
            !showAddAgent &&
            actionButton('➕ Add as Agent', () => setShowAddAgent(true))}
          {showAddAgent && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 12,
                background: 'rgba(0, 0, 0, 0.03)',
                borderRadius: 10,
                border: '1px solid rgba(0, 0, 0, 0.06)',
              }}
            >
              <input
                type="text"
                placeholder="Agent name..."
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddAsAgent()}
                autoFocus
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  fontSize: 13,
                  fontFamily: FONT_FAMILY,
                  outline: 'none',
                  background: '#fff',
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                {actionButton(isAddingAgent ? 'Creating...' : '✓ Save', handleAddAsAgent, {
                  primary: true,
                  disabled: !agentName.trim() || isAddingAgent,
                })}
                {actionButton('Cancel', () => {
                  setShowAddAgent(false)
                  setAgentName('')
                })}
              </div>
              {addAgentError && (
                <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>
                  {addAgentError}
                </div>
              )}
            </div>
          )}
          {actionButton('⏸️ Pause Session', () => {}, { disabled: true })}
          {actionButton('🔄 Restart Agent', () => {}, { disabled: true })}
        </div>
      </div>
    </div>
  )
}

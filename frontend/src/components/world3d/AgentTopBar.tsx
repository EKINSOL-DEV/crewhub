import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useChatContext } from '@/contexts/ChatContext'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { getSessionDisplayName } from '@/lib/minionUtils'
import { isSubagent } from './utils/botVariants'
import type { CrewSession } from '@/lib/api'
import type { BotVariantConfig } from './utils/botVariants'
import type { AgentRuntime } from '@/hooks/useAgentsRegistry'

// ─── Types ─────────────────────────────────────────────────────

interface AgentTopBarProps {
  sessions: CrewSession[]
  getBotConfig: (sessionKey: string, label?: string) => BotVariantConfig
  getRoomForSession: (
    sessionKey: string,
    sessionData?: { label?: string; model?: string; channel?: string }
  ) => string | undefined
  defaultRoomId?: string
  isActivelyRunning: (key: string) => boolean
  displayNames: Map<string, string | null>
  rooms: Array<{ id: string; name: string }>
  /** All agent runtimes from useAgentsRegistry — passed from outside Canvas context */
  agentRuntimes?: AgentRuntime[]
}

type AgentStatus = 'active' | 'idle' | 'sleeping' | 'supervising' | 'offline'

const BOSS_SESSION_KEY = 'agent:main:main'
const PINNED_STORAGE_KEY = 'crewhub-pinned-agent'

// ─── Helpers ───────────────────────────────────────────────────

function getAgentStatus(session: CrewSession, isActive: boolean): AgentStatus {
  if (isActive) return 'active'
  const idleMs = Date.now() - session.updatedAt
  if (idleMs < SESSION_CONFIG.botIdleThresholdMs) return 'idle'
  return 'sleeping'
}

function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'active':
      return '#22c55e'
    case 'idle':
      return '#9ca3af'
    case 'supervising':
      return '#a78bfa'
    case 'sleeping':
      return '#ef4444'
    case 'offline':
      return '#6b7280'
  }
}

function getRoomId(
  session: CrewSession,
  getRoomForSession: AgentTopBarProps['getRoomForSession'],
  defaultRoomId?: string
): string {
  return (
    getRoomForSession(session.key, {
      label: session.label,
      model: session.model,
      channel: session.lastChannel || session.channel,
    }) ||
    defaultRoomId ||
    'headquarters'
  )
}

function getRoomName(roomId: string, rooms: Array<{ id: string; name: string }>): string {
  const room = rooms.find((r) => r.id === roomId)
  return room?.name || roomId
}

// ─── Color Utilities ───────────────────────────────────────────

function darken(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `#${Math.round(r * factor)
    .toString(16)
    .padStart(2, '0')}${Math.round(g * factor)
    .toString(16)
    .padStart(2, '0')}${Math.round(b * factor)
    .toString(16)
    .padStart(2, '0')}`
}

function lighten(hex: string, factor: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `#${Math.min(255, Math.round(r + (255 - r) * factor))
    .toString(16)
    .padStart(2, '0')}${Math.min(255, Math.round(g + (255 - g) * factor))
    .toString(16)
    .padStart(2, '0')}${Math.min(255, Math.round(b + (255 - b) * factor))
    .toString(16)
    .padStart(2, '0')}`
}

// ─── Bot Face SVG ──────────────────────────────────────────────

function BotFaceSVG({
  color,
  expression,
  size = 36,
}: {
  color: string
  expression: string
  size?: number
}) {
  const pupilDx = expression === 'thoughtful' ? 1 : expression === 'talking' ? -0.5 : 0
  const pupilDy = expression === 'thoughtful' ? 1 : expression === 'serious' ? -0.5 : 0

  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
      <rect x="4" y="3" width="28" height="24" rx="8" fill={lighten(color, 0.15)} />
      <rect x="4" y="3" width="28" height="24" rx="8" fill="white" opacity="0.15" />
      <circle cx="12" cy="14" r="5" fill="white" />
      <circle cx={12 + pupilDx} cy={14 + pupilDy} r="2.8" fill="#1a1a1a" />
      <circle cx={13.2 + pupilDx} cy={12.8 + pupilDy} r="1" fill="white" />
      <circle cx="24" cy="14" r="5" fill="white" />
      <circle cx={24 + pupilDx} cy={14 + pupilDy} r="2.8" fill="#1a1a1a" />
      <circle cx={25.2 + pupilDx} cy={12.8 + pupilDy} r="1" fill="white" />
      {expression === 'happy' && (
        <path
          d="M12 22 Q18 27 24 22"
          stroke="#333"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {expression === 'thoughtful' && (
        <path
          d="M14 23 Q18 25 22 23"
          stroke="#333"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      )}
      {expression === 'determined' && (
        <line
          x1="13"
          y1="23"
          x2="23"
          y2="23"
          stroke="#333"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      )}
      {expression === 'talking' && <ellipse cx="18" cy="23" rx="3" ry="2" fill="#e05080" />}
      {expression === 'serious' && (
        <path
          d="M13 24 Q18 22 23 24"
          stroke="#333"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />
      )}
      <rect x="6" y="27" width="24" height="8" rx="4" fill={darken(color, 0.85)} />
    </svg>
  )
}

// ─── Agent Portrait Button ─────────────────────────────────────

interface AgentPortraitButtonProps {
  config: BotVariantConfig
  name: string
  isActive: boolean
  onClick: () => void
  title: string
  onUnpin?: () => void
  showUnpin?: boolean
}

function AgentPortraitButton({
  config,
  name,
  isActive,
  onClick,
  title,
  onUnpin,
  showUnpin,
}: AgentPortraitButtonProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
    >
      {/* Portrait circle */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: `linear-gradient(145deg, ${config.color}ee, ${darken(config.color, 0.7)}ee)`,
          border: `3px solid ${isActive ? '#22c55e' : 'rgba(255,255,255,0.5)'}`,
          boxShadow: isActive
            ? `0 0 16px ${config.color}66, 0 0 32px ${config.color}33, 0 4px 12px rgba(0,0,0,0.2)`
            : '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          animation: isActive ? 'agentTopBarGlow 2s ease-in-out infinite' : undefined,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <BotFaceSVG color={config.color} expression={config.expression} />
        {isActive && (
          <div
            style={{
              position: 'absolute',
              bottom: 2,
              right: 2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#22c55e',
              border: '2px solid white',
              animation: 'agentTopBarActivePulse 1.5s ease-in-out infinite',
            }}
          />
        )}
      </div>

      {/* Name label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(55, 65, 81, 0.9)',
          fontFamily: 'system-ui, sans-serif',
          textShadow: '0 1px 3px rgba(255,255,255,0.8)',
          letterSpacing: '0.02em',
          background: 'rgba(255,255,255,0.6)',
          padding: '1px 6px',
          borderRadius: 6,
          backdropFilter: 'blur(4px)',
          maxWidth: 80,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center',
        }}
      >
        {name}
      </div>

      {/* Unpin button on hover */}
      {showUnpin && hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onUnpin?.()
          }}
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: '2px solid white',
            background: 'rgba(0,0,0,0.6)',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: 1,
            padding: 0,
            zIndex: 2,
            backdropFilter: 'blur(4px)',
          }}
          title="Unpin agent"
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ─── Agent Picker Button ───────────────────────────────────────

function AgentPickerToggle({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Browse agents"
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: isOpen ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)',
          border: `3px solid ${isOpen ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}`,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          transform: hovered ? 'scale(1.1)' : 'scale(1)',
          backdropFilter: 'blur(8px)',
          fontSize: 22,
          color: 'rgba(255,255,255,0.9)',
          letterSpacing: 2,
        }}
      >
        ⋯
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(55, 65, 81, 0.9)',
          fontFamily: 'system-ui, sans-serif',
          textShadow: '0 1px 3px rgba(255,255,255,0.8)',
          letterSpacing: '0.02em',
          background: 'rgba(255,255,255,0.6)',
          padding: '1px 6px',
          borderRadius: 6,
          backdropFilter: 'blur(4px)',
        }}
      >
        Agents
      </div>
    </div>
  )
}

// ─── Agent Picker Dropdown ─────────────────────────────────────

interface DropdownEntry {
  session: CrewSession
  config: BotVariantConfig
  name: string
  status: AgentStatus
  roomName: string
  roomId: string
}

interface AgentPickerDropdownProps {
  fixedAgents: DropdownEntry[]
  recentSubagents: DropdownEntry[]
  pinnedKey: string | null
  onSelect: (session: CrewSession, roomId: string, name: string, config: BotVariantConfig) => void
  onPin: (sessionKey: string) => void
  onClose: () => void
}

function AgentPickerDropdown({
  fixedAgents,
  recentSubagents,
  pinnedKey,
  onSelect,
  onPin,
  onClose,
}: AgentPickerDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // Delay to avoid the click that opened the dropdown from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  return (
    <div
      ref={dropdownRef}
      className="agent-picker-dropdown"
      style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 8,
        width: 280,
        maxHeight: 420,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(255,255,255,0.15) transparent',
        background: 'rgba(15, 15, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        padding: '8px 0',
        zIndex: 40,
        animation: 'agentPickerSlideIn 0.15s ease-out',
      }}
    >
      {/* Fixed Agents */}
      {fixedAgents.length > 0 && (
        <>
          <div
            style={{
              padding: '6px 14px 4px',
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Fixed Agents
          </div>
          {fixedAgents.map((entry) => (
            <DropdownItem
              key={entry.session.key}
              entry={entry}
              isPinned={entry.session.key === pinnedKey}
              onSelect={onSelect}
              onPin={onPin}
            />
          ))}
        </>
      )}

      {/* Recently Active Subagents */}
      {recentSubagents.length > 0 && (
        <>
          <div
            style={{
              padding: '10px 14px 4px',
              fontSize: 10,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontFamily: 'system-ui, sans-serif',
              borderTop: fixedAgents.length > 0 ? '1px solid rgba(255,255,255,0.08)' : undefined,
              marginTop: fixedAgents.length > 0 ? 4 : 0,
            }}
          >
            Recently Active
          </div>
          {recentSubagents.map((entry) => (
            <DropdownItem
              key={entry.session.key}
              entry={entry}
              isPinned={entry.session.key === pinnedKey}
              onSelect={onSelect}
              onPin={onPin}
            />
          ))}
        </>
      )}

      {fixedAgents.length === 0 && recentSubagents.length === 0 && (
        <div
          style={{
            padding: '16px 14px',
            textAlign: 'center',
            fontSize: 12,
            color: 'rgba(255,255,255,0.35)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          No agents found
        </div>
      )}
    </div>
  )
}

// ─── Dropdown Item ─────────────────────────────────────────────

function DropdownItem({
  entry,
  isPinned,
  onSelect,
  onPin,
}: {
  entry: DropdownEntry
  isPinned: boolean
  onSelect: (session: CrewSession, roomId: string, name: string, config: BotVariantConfig) => void
  onPin: (sessionKey: string) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        cursor: 'pointer',
        transition: 'background 0.15s',
        background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(entry.session, entry.roomId, entry.name, entry.config)}
    >
      {/* Small bot portrait */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: `linear-gradient(145deg, ${entry.config.color}cc, ${darken(entry.config.color, 0.7)}cc)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <BotFaceSVG color={entry.config.color} expression={entry.config.expression} size={22} />
        {/* Status dot */}
        <div
          style={{
            position: 'absolute',
            bottom: -1,
            right: -1,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: getStatusColor(entry.status),
            border: '2px solid rgba(15, 15, 20, 0.88)',
          }}
        />
      </div>

      {/* Name + room */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.9)',
            fontFamily: 'system-ui, sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.name}
          {isPinned && <span style={{ marginLeft: 4, fontSize: 10 }}>📌</span>}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.35)',
            fontFamily: 'system-ui, sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.roomName}
        </div>
      </div>

      {/* Pin button on hover */}
      {hovered && !isPinned && entry.session.key !== BOSS_SESSION_KEY && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPin(entry.session.key)
          }}
          style={{
            padding: '3px 6px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: 11,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            fontFamily: 'system-ui, sans-serif',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
          title="Pin to top bar"
        >
          📌 Pin
        </button>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────

export function AgentTopBar({
  sessions,
  getBotConfig,
  getRoomForSession,
  defaultRoomId,
  isActivelyRunning,
  displayNames,
  rooms,
  agentRuntimes,
}: AgentTopBarProps) {
  const { state, focusBot } = useWorldFocus()
  const { openChat } = useChatContext()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pinnedKey, setPinnedKey] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PINNED_STORAGE_KEY)
    } catch {
      return null
    }
  })

  // Persist pinned agent
  useEffect(() => {
    try {
      if (pinnedKey) {
        localStorage.setItem(PINNED_STORAGE_KEY, pinnedKey)
      } else {
        localStorage.removeItem(PINNED_STORAGE_KEY)
      }
    } catch {
      // Ignore
    }
  }, [pinnedKey])

  // ─── Boss session ──────────────────────────────────────────────

  const bossSession = useMemo(() => sessions.find((s) => s.key === BOSS_SESSION_KEY), [sessions])

  const bossConfig = useMemo(
    () => getBotConfig(BOSS_SESSION_KEY, bossSession?.label),
    [getBotConfig, bossSession?.label]
  )

  const bossRoomId = useMemo(() => {
    if (!bossSession) return defaultRoomId || 'headquarters'
    return getRoomId(bossSession, getRoomForSession, defaultRoomId)
  }, [bossSession, getRoomForSession, defaultRoomId])

  const bossIsActive = bossSession ? isActivelyRunning(bossSession.key) : false

  // ─── Pinned agent ──────────────────────────────────────────────

  const pinnedSession = useMemo(
    () => (pinnedKey ? sessions.find((s) => s.key === pinnedKey) : null),
    [sessions, pinnedKey]
  )

  const pinnedConfig = useMemo(
    () => (pinnedSession ? getBotConfig(pinnedSession.key, pinnedSession.label) : null),
    [getBotConfig, pinnedSession]
  )

  const pinnedRoomId = useMemo(() => {
    if (!pinnedSession) return null
    return getRoomId(pinnedSession, getRoomForSession, defaultRoomId)
  }, [pinnedSession, getRoomForSession, defaultRoomId])

  const pinnedName = useMemo(() => {
    if (!pinnedSession) return ''
    return getSessionDisplayName(pinnedSession, displayNames.get(pinnedSession.key))
  }, [pinnedSession, displayNames])

  const pinnedIsActive = pinnedSession ? isActivelyRunning(pinnedSession.key) : false

  // ─── Dropdown entries ──────────────────────────────────────────

  const { fixedAgents, recentSubagents } = useMemo(() => {
    const now = Date.now()
    const RECENT_THRESHOLD_MS = 30 * 60 * 1000 // 30 minutes

    const fixedAgents: DropdownEntry[] = []
    const recentSubagents: DropdownEntry[] = []

    if (agentRuntimes && agentRuntimes.length > 0) {
      // ─── Registry-based: all agents from /api/agents, merged with session data ──
      for (const runtime of agentRuntimes) {
        const { agent, session } = runtime
        // Resolve the canonical session key for this agent
        const agentKey = agent.agent_session_key || `agent:${agent.name.toLowerCase()}:main`
        // Skip boss — always shown separately
        if (agentKey === BOSS_SESSION_KEY) continue

        let entry: DropdownEntry

        if (session) {
          // Agent has an active session — use full session data
          const config = getBotConfig(session.key, session.label)
          const name = getSessionDisplayName(session, displayNames.get(session.key))
          const isActive = isActivelyRunning(session.key)
          const status = getAgentStatus(session, isActive)
          const roomId = getRoomId(session, getRoomForSession, defaultRoomId)
          const roomName = getRoomName(roomId, rooms)
          entry = { session, config, name, status, roomName, roomId }
        } else {
          // Agent exists in DB but has no active session — show as offline
          const syntheticSession: CrewSession = {
            key: agentKey,
            sessionId: agentKey,
            kind: 'agent',
            channel: 'whatsapp',
            updatedAt: 0,
            label: agent.name,
          }
          const config = getBotConfig(agentKey, agent.name)
          const name = agent.name
          const status: AgentStatus = 'offline'
          const roomId = agent.default_room_id || defaultRoomId || 'headquarters'
          const roomName = getRoomName(roomId, rooms)
          entry = { session: syntheticSession, config, name, status, roomName, roomId }
        }

        fixedAgents.push(entry)
      }
    } else {
      // ─── Fallback: build fixed agents from active sessions only ──────────────
      for (const session of sessions) {
        // Skip boss — it's always in the bar
        if (session.key === BOSS_SESSION_KEY) continue
        // Skip debug sessions
        if (session.key.startsWith('debug:')) continue

        const config = getBotConfig(session.key, session.label)
        const name = getSessionDisplayName(session, displayNames.get(session.key))
        const isActive = isActivelyRunning(session.key)
        const status = getAgentStatus(session, isActive)
        const roomId = getRoomId(session, getRoomForSession, defaultRoomId)
        const roomName = getRoomName(roomId, rooms)

        const entry: DropdownEntry = { session, config, name, status, roomName, roomId }

        // Fixed agents: agent:*:main (not subagents)
        const parts = session.key.split(':')
        if (parts.length === 3 && parts[0] === 'agent' && parts[2] === 'main') {
          fixedAgents.push(entry)
        }
      }
    }

    // Recently active subagents (always from session list, not registry)
    for (const session of sessions) {
      if (session.key === BOSS_SESSION_KEY) continue
      if (session.key.startsWith('debug:')) continue
      if (isSubagent(session.key) && now - session.updatedAt < RECENT_THRESHOLD_MS) {
        const config = getBotConfig(session.key, session.label)
        const name = getSessionDisplayName(session, displayNames.get(session.key))
        const isActive = isActivelyRunning(session.key)
        const status = getAgentStatus(session, isActive)
        const roomId = getRoomId(session, getRoomForSession, defaultRoomId)
        const roomName = getRoomName(roomId, rooms)
        recentSubagents.push({ session, config, name, status, roomName, roomId })
      }
    }

    // Sort fixed agents alphabetically
    fixedAgents.sort((a, b) => a.name.localeCompare(b.name))
    // Sort recent subagents by most recent first
    recentSubagents.sort((a, b) => b.session.updatedAt - a.session.updatedAt)

    return { fixedAgents, recentSubagents }
  }, [
    sessions,
    agentRuntimes,
    getBotConfig,
    isActivelyRunning,
    getRoomForSession,
    defaultRoomId,
    rooms,
    displayNames,
  ])

  // ─── Handlers ──────────────────────────────────────────────────

  const handleBossClick = useCallback(() => {
    if (bossRoomId) focusBot(BOSS_SESSION_KEY, bossRoomId)
    openChat(BOSS_SESSION_KEY, 'Assistent', bossConfig.icon, bossConfig.color)
  }, [bossRoomId, focusBot, openChat, bossConfig])

  const handlePinnedClick = useCallback(() => {
    if (!pinnedSession || !pinnedRoomId || !pinnedConfig) return
    focusBot(pinnedSession.key, pinnedRoomId)
    // openChat is guarded by isFixedAgent internally, safe to call
    openChat(pinnedSession.key, pinnedName, pinnedConfig.icon, pinnedConfig.color)
  }, [pinnedSession, pinnedRoomId, pinnedConfig, pinnedName, focusBot, openChat])

  const handleUnpin = useCallback(() => {
    setPinnedKey(null)
  }, [])

  const handleDropdownSelect = useCallback(
    (session: CrewSession, roomId: string, name: string, config: BotVariantConfig) => {
      // Only fly to the bot if it has a real session (updatedAt > 0 means it exists)
      if (session.updatedAt > 0) {
        focusBot(session.key, roomId)
      }
      openChat(session.key, name, config.icon, config.color)
      setPickerOpen(false)
    },
    [focusBot, openChat]
  )

  const handlePin = useCallback((sessionKey: string) => {
    setPinnedKey(sessionKey)
    setPickerOpen(false)
  }, [])

  const handlePickerToggle = useCallback(() => {
    setPickerOpen((prev) => !prev)
  }, [])

  const handleDropdownClose = useCallback(() => {
    setPickerOpen(false)
  }, [])

  // Hidden in first-person and bot-focus modes
  if (state.level === 'firstperson' || state.level === 'bot') return null
  if (!bossSession) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      {/* Pinned agent (left of Assistent) */}
      {pinnedSession && pinnedConfig && (
        <AgentPortraitButton
          config={pinnedConfig}
          name={pinnedName}
          isActive={pinnedIsActive}
          onClick={handlePinnedClick}
          title={`Fly to ${pinnedName}`}
          showUnpin
          onUnpin={handleUnpin}
        />
      )}

      {/* Assistent (center, always visible) */}
      <AgentPortraitButton
        config={bossConfig}
        name="Assistent"
        isActive={bossIsActive}
        onClick={handleBossClick}
        title="Fly to Assistent"
      />

      {/* Agent Picker (right of Assistent) */}
      <div style={{ position: 'relative' }}>
        <AgentPickerToggle isOpen={pickerOpen} onClick={handlePickerToggle} />
        {pickerOpen && (
          <AgentPickerDropdown
            fixedAgents={fixedAgents}
            recentSubagents={recentSubagents}
            pinnedKey={pinnedKey}
            onSelect={handleDropdownSelect}
            onPin={handlePin}
            onClose={handleDropdownClose}
          />
        )}
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes agentTopBarGlow {
          0%, 100% { box-shadow: 0 0 16px var(--glow-color, rgba(100,100,255,0.4)), 0 0 32px var(--glow-color, rgba(100,100,255,0.2)), 0 4px 12px rgba(0,0,0,0.2); }
          50% { box-shadow: 0 0 24px var(--glow-color, rgba(100,100,255,0.5)), 0 0 48px var(--glow-color, rgba(100,100,255,0.3)), 0 4px 12px rgba(0,0,0,0.2); }
        }
        @keyframes agentTopBarActivePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes agentPickerSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .agent-picker-dropdown::-webkit-scrollbar { width: 4px; }
        .agent-picker-dropdown::-webkit-scrollbar-track { background: transparent; }
        .agent-picker-dropdown::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
      `}</style>
    </div>
  )
}

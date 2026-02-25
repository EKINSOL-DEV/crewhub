import { useMemo } from 'react'
import { useWorldFocus } from '@/contexts/WorldFocusContext'
import { useChatContext } from '@/contexts/ChatContext'
import type { CrewSession } from '@/lib/api'
import type { BotVariantConfig } from './utils/botVariants'

interface BossHudButtonProps {
  /** All sessions to search for the boss */
  readonly sessions: CrewSession[]
  /** Get bot config from session key */
  readonly getBotConfig: (sessionKey: string, label?: string) => BotVariantConfig
  /** Determine which room a session belongs to */
  readonly getRoomForSession: (
    sessionKey: string,
    sessionData?: { label?: string; model?: string; channel?: string }
  ) => string | undefined
  /** Default room ID fallback */
  readonly defaultRoomId?: string
  /** Is the boss actively running? */
  readonly isActivelyRunning: (key: string) => boolean
}

const BOSS_SESSION_KEY = 'agent:main:main'

/**
 * Persistent HUD button showing the "boss" agent (agent:main:main).
 * Fixed position bottom-right, shows a mini bot portrait.
 * Clicking flies the camera to the boss bot.
 * Hidden in first-person and bot-focus modes.
 */
export function BossHudButton({
  sessions,
  getBotConfig,
  getRoomForSession,
  defaultRoomId,
  isActivelyRunning,
}: BossHudButtonProps) {
  const { state, focusBot } = useWorldFocus()
  const { openChat } = useChatContext()

  const bossSession = useMemo(() => sessions.find((s) => s.key === BOSS_SESSION_KEY), [sessions])

  const bossConfig = useMemo(
    () => getBotConfig(BOSS_SESSION_KEY, bossSession?.label),
    [getBotConfig, bossSession?.label]
  )

  const bossRoomId = useMemo(() => {
    if (!bossSession) return defaultRoomId || 'headquarters'
    return (
      getRoomForSession(bossSession.key, {
        label: bossSession.label,
        model: bossSession.model,
        channel: bossSession.lastChannel || bossSession.channel,
      }) ||
      defaultRoomId ||
      'headquarters'
    )
  }, [bossSession, getRoomForSession, defaultRoomId])

  const isActive = bossSession ? isActivelyRunning(bossSession.key) : false

  // Hidden in first-person and bot-focus modes
  if (state.level === 'firstperson' || state.level === 'bot') return null

  // If boss session doesn't exist, don't show
  if (!bossSession) return null

  const handleClick = () => {
    if (bossRoomId) {
      focusBot(BOSS_SESSION_KEY, bossRoomId)
    }
    openChat(BOSS_SESSION_KEY, 'Assistent', bossConfig.icon, bossConfig.color)
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 35,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={handleClick}
      title="Fly to Assistent"
    >
      {/* Portrait circle */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: `linear-gradient(145deg, ${bossConfig.color}ee, ${darken(bossConfig.color, 0.7)}ee)`,
          border: `3px solid ${isActive ? '#22c55e' : 'rgba(255,255,255,0.5)'}`,
          boxShadow: isActive
            ? `0 0 16px ${bossConfig.color}66, 0 0 32px ${bossConfig.color}33, 0 4px 12px rgba(0,0,0,0.2)`
            : '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          animation: isActive ? 'bossGlow 2s ease-in-out infinite' : undefined,
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.boxShadow = `0 0 20px ${bossConfig.color}88, 0 6px 16px rgba(0,0,0,0.3)`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = isActive
            ? `0 0 16px ${bossConfig.color}66, 0 0 32px ${bossConfig.color}33, 0 4px 12px rgba(0,0,0,0.2)`
            : '0 4px 12px rgba(0,0,0,0.2)'
        }}
      >
        {/* Mini bot face */}
        <BotFaceSVG color={bossConfig.color} expression={bossConfig.expression} />

        {/* Active indicator dot */}
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
              animation: 'bossActivePulse 1.5s ease-in-out infinite',
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
        }}
      >
        Assistent
      </div>

      {/* Inject keyframes */}
      <style>{`
        @keyframes bossGlow {
          0%, 100% { box-shadow: 0 0 16px ${bossConfig.color}66, 0 0 32px ${bossConfig.color}33, 0 4px 12px rgba(0,0,0,0.2); }
          50% { box-shadow: 0 0 24px ${bossConfig.color}88, 0 0 48px ${bossConfig.color}44, 0 4px 12px rgba(0,0,0,0.2); }
        }
        @keyframes bossActivePulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

// ─── SVG Bot Face ──────────────────────────────────────────────

function BotFaceSVG({ color, expression }: { color: string; expression: string }) {
  // Determine pupil and mouth based on expression
  let pupilDx: number
  if (expression === 'thoughtful') {
    pupilDx = 1
  } else if (expression === 'talking') {
    pupilDx = -0.5
  } else {
    pupilDx = 0
  }
  let pupilDy: number
  if (expression === 'thoughtful') {
    pupilDy = 1
  } else if (expression === 'serious') {
    pupilDy = -0.5
  } else {
    pupilDy = 0
  }

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      {/* Head shape */}
      <rect x="4" y="3" width="28" height="24" rx="8" fill={lighten(color, 0.15)} />
      <rect x="4" y="3" width="28" height="24" rx="8" fill="white" opacity="0.15" />

      {/* Left eye */}
      <circle cx="12" cy="14" r="5" fill="white" />
      <circle cx={12 + pupilDx} cy={14 + pupilDy} r="2.8" fill="#1a1a1a" />
      <circle cx={13.2 + pupilDx} cy={12.8 + pupilDy} r="1" fill="white" />

      {/* Right eye */}
      <circle cx="24" cy="14" r="5" fill="white" />
      <circle cx={24 + pupilDx} cy={14 + pupilDy} r="2.8" fill="#1a1a1a" />
      <circle cx={25.2 + pupilDx} cy={12.8 + pupilDy} r="1" fill="white" />

      {/* Mouth */}
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

      {/* Body hint */}
      <rect x="6" y="27" width="24" height="8" rx="4" fill={darken(color, 0.85)} />
    </svg>
  )
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

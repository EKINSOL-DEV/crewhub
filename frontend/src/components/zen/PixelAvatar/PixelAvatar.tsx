/**
 * PixelAvatar Component
 *
 * Retro 8-bit style robot avatar for Zen Mode chat panel.
 * Shows agent status with cute animations and hover stats.
 */

import { useMemo, useState, useEffect } from 'react'
import {
  getPattern,
  getAgentType,
  getAgentColors,
  type AgentType,
  type AnimationState,
  type PixelValue,
} from './pixelPatterns'
import './PixelAvatar.css'

interface PixelAvatarProps {
  /** Agent name (used to determine type/color) */
  agentName: string | null
  /** Current status */
  status: 'active' | 'thinking' | 'idle' | 'error'
  /** Optional stats to show on hover */
  stats?: {
    tokens?: number
    uptime?: number // in milliseconds
    model?: string
    sessionKey?: string
  }
}

/**
 * Format uptime from milliseconds to human readable
 */
function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

/**
 * Format token count with K suffix
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`
  return tokens.toString()
}

/**
 * Get animation state from status
 */
function getAnimationState(status: PixelAvatarProps['status']): AnimationState {
  switch (status) {
    case 'thinking':
      return 'thinking'
    case 'active':
      return 'typing'
    case 'error':
      return 'error'
    default:
      return 'idle'
  }
}

/**
 * Get display status text
 */
function getStatusText(status: PixelAvatarProps['status']): string {
  switch (status) {
    case 'thinking':
      return 'Thinking...'
    case 'active':
      return 'Active'
    case 'error':
      return 'Error'
    default:
      return 'Idle'
  }
}

/**
 * Single pixel cell
 */
function PixelCell({
  value,
  colors,
}: {
  value: PixelValue
  colors: { base: string; dark: string; accent: string }
}) {
  const backgroundColor = useMemo(() => {
    switch (value) {
      case 0:
        return 'transparent'
      case 1:
        return colors.base
      case 2:
        return '#ffffff' // highlight (eyes)
      case 3:
        return colors.dark
      case 4:
        return colors.accent
      default:
        return 'transparent'
    }
  }, [value, colors])

  return <div className="pixel-avatar-cell" style={{ backgroundColor }} />
}

/**
 * Pixel Avatar Component
 */
export function PixelAvatar({ agentName, status, stats }: PixelAvatarProps) {
  const [frame, setFrame] = useState(0)

  const agentType: AgentType = useMemo(() => getAgentType(agentName), [agentName])
  const colors = useMemo(() => getAgentColors(agentType), [agentType])
  const animState = useMemo(() => getAnimationState(status), [status])
  const pattern = useMemo(() => getPattern(animState, frame), [animState, frame])

  // Animate frame for thinking/typing states
  useEffect(() => {
    if (animState === 'thinking' || animState === 'typing') {
      const interval = setInterval(
        () => {
          setFrame((f) => f + 1)
        },
        animState === 'typing' ? 300 : 800
      )
      return () => clearInterval(interval)
    } else {
      setFrame(0)
    }
  }, [animState])

  const statusClass = `pixel-avatar--${animState}`
  const statusText = getStatusText(status)
  const statusColorClass =
    status === 'error'
      ? 'pixel-avatar-tooltip-value--error'
      : status === 'idle'
        ? 'pixel-avatar-tooltip-value--idle'
        : 'pixel-avatar-tooltip-value--active'

  return (
    <div className={`pixel-avatar ${statusClass}`}>
      <div className="pixel-avatar-grid">
        {pattern.map((row, y) =>
          row.map((value, x) => <PixelCell key={`${x}-${y}`} value={value} colors={colors} />)
        )}
      </div>

      {/* Hover tooltip with stats */}
      <div className="pixel-avatar-tooltip">
        <div className="pixel-avatar-tooltip-header">
          <span className="pixel-avatar-tooltip-icon">🤖</span>
          <span>{agentName || 'Agent'}</span>
        </div>

        <div className="pixel-avatar-tooltip-stat">
          <span className="pixel-avatar-tooltip-label">Status</span>
          <span className={`pixel-avatar-tooltip-value ${statusColorClass}`}>{statusText}</span>
        </div>

        {stats?.tokens !== undefined && (
          <div className="pixel-avatar-tooltip-stat">
            <span className="pixel-avatar-tooltip-label">Tokens</span>
            <span className="pixel-avatar-tooltip-value">{formatTokens(stats.tokens)}</span>
          </div>
        )}

        {stats?.uptime !== undefined && (
          <div className="pixel-avatar-tooltip-stat">
            <span className="pixel-avatar-tooltip-label">Uptime</span>
            <span className="pixel-avatar-tooltip-value">{formatUptime(stats.uptime)}</span>
          </div>
        )}

        {stats?.model && (
          <div className="pixel-avatar-tooltip-stat">
            <span className="pixel-avatar-tooltip-label">Model</span>
            <span className="pixel-avatar-tooltip-value">
              {stats.model.split('/').pop() || stats.model}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default PixelAvatar

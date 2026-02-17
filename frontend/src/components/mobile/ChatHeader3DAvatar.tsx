/**
 * ChatHeader3DAvatar
 *
 * Renders a small 3D character preview for the mobile chat header.
 * - 128px wide × 72px tall, landscape portrait
 * - rounded-xl corners + subtle border
 * - Non-interactive (no orbit controls / drag)
 * - Lazy-loads the Three.js canvas; falls back to a static avatar if WebGL
 *   is not available or device has < 4 GB RAM.
 */

import { lazy, Suspense, useState, type CSSProperties } from 'react'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'
import type { AgentStatus } from './AgentCameraView'

// ── Animation type ─────────────────────────────────────────────

export type AvatarAnimation = 'idle' | 'thinking' | 'talking'

// ── Capability detection ───────────────────────────────────────

function canRender3D(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number }
    if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    return !!gl
  } catch {
    return false
  }
}

// ── Lazy 3D scene ──────────────────────────────────────────────

const ChatHeader3DScene = lazy(() => import('./ChatHeader3DScene'))

// ── Static fallback avatar ─────────────────────────────────────

function StaticAvatar({ config, icon }: { config: BotVariantConfig; icon: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: config.color + '28',
        color: config.color,
        fontSize: 28,
        fontWeight: 600,
        borderRadius: 'inherit',
      }}
    >
      {icon}
    </div>
  )
}

// ── Loading placeholder ────────────────────────────────────────

function LoadingPlaceholder({ color }: { color: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1626',
        borderRadius: 'inherit',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          border: `2px solid ${color}40`,
          borderTopColor: color,
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

interface ChatHeader3DAvatarProps {
  config: BotVariantConfig
  agentStatus: AgentStatus
  /** Animation mode — controls movement behaviour */
  animation?: AvatarAnimation
  /** Fallback icon/emoji (if 3D unavailable) */
  icon: string
  /** Container style overrides */
  style?: CSSProperties
}

export function ChatHeader3DAvatar({
  config,
  agentStatus,
  animation = 'idle',
  icon,
  style,
}: ChatHeader3DAvatarProps) {
  const [has3D] = useState(() => canRender3D())

  const containerStyle: CSSProperties = {
    width: 128,
    height: 230, // DEBUG: expanded for camera tuning (restore to 72 after)
    borderRadius: 14,
    overflow: 'visible', // DEBUG: show buttons below canvas
    flexShrink: 0,
    border: `1px solid ${config.color}30`,
    background: '#0d1626',
    position: 'relative',
    ...style,
  }

  return (
    <div style={containerStyle}>
      {has3D ? (
        <Suspense fallback={<LoadingPlaceholder color={config.color} />}>
          <ChatHeader3DScene
            botConfig={config}
            agentStatus={agentStatus}
            animation={animation}
          />
        </Suspense>
      ) : (
        <StaticAvatar config={config} icon={icon} />
      )}
    </div>
  )
}

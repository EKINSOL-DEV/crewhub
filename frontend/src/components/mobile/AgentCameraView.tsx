import { useState, lazy, Suspense } from 'react'
import { Camera, Minimize2, Maximize2 } from 'lucide-react'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'

// ── Capability Detection ───────────────────────────────────────

function canRender3D(): boolean {
  try {
    const nav = navigator as any
    if (nav.deviceMemory && nav.deviceMemory < 4) return false
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return false
    return true
  } catch {
    return false
  }
}

// ── Lazy-loaded 3D Scene ───────────────────────────────────────

const AgentScene3D = lazy(() => import('./AgentScene3D'))

// ── Types ──────────────────────────────────────────────────────

export type AgentStatus = 'active' | 'idle' | 'sleeping'

type ViewportSize = 'small' | 'expanded'

// ── Status helpers ─────────────────────────────────────────────

function getStatusInfo(status: AgentStatus) {
  switch (status) {
    case 'active':
      return { color: '#22c55e', label: 'Working', emoji: '⚡' }
    case 'idle':
      return { color: '#f59e0b', label: 'Idle', emoji: '😌' }
    case 'sleeping':
      return { color: '#6366f1', label: 'Sleeping', emoji: '😴' }
  }
}

// ── Static Fallback (for non-3D devices) ───────────────────────

function StaticAgentAvatar({ config, status }: Readonly<{ config: BotVariantConfig; status: AgentStatus }>) {
  const info = getStatusInfo(status)

  const eyeStyle: React.CSSProperties = {
    width: 14,
    height: status === 'sleeping' ? 3 : 14,
    borderRadius: status === 'sleeping' ? 3 : '50%',
    background: '#fff',
    position: 'relative' as const,
    transition: 'all 0.4s ease',
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background:
          'radial-gradient(ellipse at center, var(--mobile-bg-secondary, #1e293b) 0%, var(--mobile-bg, #0f172a) 100%)',
        gap: 6,
      }}
    >
      <div
        style={{
          width: 52,
          height: 46,
          borderRadius: 12,
          background: config.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <div style={eyeStyle}>
          {status !== 'sleeping' && (
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#1a1a1a',
                position: 'absolute',
                top: 3,
                left: 3,
              }}
            />
          )}
        </div>
        <div style={eyeStyle}>
          {status !== 'sleeping' && (
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#1a1a1a',
                position: 'absolute',
                top: 3,
                left: 3,
              }}
            />
          )}
        </div>
      </div>
      <div
        style={{ fontSize: 10, color: info.color, display: 'flex', alignItems: 'center', gap: 3 }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: info.color,
            display: 'inline-block',
          }}
        />
        {info.label}
      </div>
    </div>
  )
}

// ── Camera Button (for chat header) ────────────────────────────

export function AgentCameraButton({
  onClick,
  isActive,
}: {
  readonly onClick: () => void
  readonly isActive?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 12,
        border: `1px solid ${isActive ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
        background: isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.05)',
        color: isActive ? 'var(--mobile-accent, #818cf8)' : 'var(--mobile-text-secondary, #94a3b8)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'all 0.15s',
      }}
    >
      <Camera size={16} />
    </button>
  )
}

// ── Floating Mini Viewport ─────────────────────────────────────

interface AgentMiniViewportProps {
  readonly isVisible: boolean
  readonly agentName: string
  readonly agentStatus: AgentStatus
  readonly botConfig: BotVariantConfig
}

export function AgentMiniViewport({ isVisible, agentStatus, botConfig }: Readonly<AgentMiniViewportProps>) {
  const [has3D] = useState(() => canRender3D())
  const [size, setSize] = useState<ViewportSize>('small')
  const info = getStatusInfo(agentStatus)

  if (!isVisible) return null

  const isSmall = size === 'small'
  const vpWidth = isSmall ? 120 : 180
  const vpHeight = isSmall ? 140 : 220

  return (
    <div
      style={{
        position: 'fixed',
        top: isSmall ? 70 : 60,
        right: 12,
        width: vpWidth,
        height: vpHeight,
        zIndex: 900,
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        background: 'var(--mobile-bg, #0f172a)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* 3D Content */}
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {has3D ? (
          <Suspense
            fallback={
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--mobile-text-muted, #475569)',
                  fontSize: 11,
                }}
              >
                Loading…
              </div>
            }
          >
            <AgentScene3D botConfig={botConfig} agentStatus={agentStatus} mini />
          </Suspense>
        ) : (
          <StaticAgentAvatar config={botConfig} status={agentStatus} />
        )}

        {/* Status badge overlay - bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '6px 8px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: info.color,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: 500,
            }}
          >
            <span>{info.emoji}</span>
            {info.label}
          </div>
          <button
            onClick={() => setSize((s) => (s === 'small' ? 'expanded' : 'small'))}
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              border: 'none',
              background: 'rgba(255,255,255,0.1)',
              color: 'var(--mobile-text-secondary, #94a3b8)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
          >
            {isSmall ? <Maximize2 size={10} /> : <Minimize2 size={10} />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Legacy export for backwards compat (redirects to mini viewport) ──

interface AgentCameraViewProps {
  readonly isOpen: boolean
  readonly agentName: string
  readonly agentStatus: AgentStatus
  readonly botConfig: BotVariantConfig
}

export function AgentCameraOverlay(props: Readonly<AgentCameraViewProps>) {
  return (
    <AgentMiniViewport
      isVisible={props.isOpen}
      agentName={props.agentName}
      agentStatus={props.agentStatus}
      botConfig={props.botConfig}
    />
  )
}

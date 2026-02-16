import { useState, useRef, lazy, Suspense, useEffect } from 'react'
import { X, Camera } from 'lucide-react'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'

// ── Capability Detection ───────────────────────────────────────

function canRender3D(): boolean {
  try {
    // Check device memory (Chrome only)
    const nav = navigator as any
    if (nav.deviceMemory && nav.deviceMemory < 4) return false
    // Check WebGL support
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

// ── Static Fallback ────────────────────────────────────────────

function StaticAgentAvatar({ config, name, status }: {
  config: BotVariantConfig
  name: string
  status: AgentStatus
}) {
  const statusColor = status === 'active' ? '#22c55e' : status === 'idle' ? '#f59e0b' : '#64748b'
  const statusLabel = status === 'active' ? 'Working' : status === 'idle' ? 'Idle' : 'Sleeping'

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, #1e293b 0%, #0f172a 100%)',
      gap: 16,
    }}>
      {/* Simple bot avatar */}
      <div style={{
        width: 120, height: 140, position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* Head */}
        <div style={{
          width: 72, height: 64, borderRadius: 16,
          background: config.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 12, position: 'relative',
        }}>
          {/* Eyes */}
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'relative' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1a1a1a', position: 'absolute', top: 5, left: 5 }} />
          </div>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'relative' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1a1a1a', position: 'absolute', top: 5, left: 5 }} />
          </div>
        </div>
        {/* Body */}
        <div style={{
          width: 80, height: 56, borderRadius: '12px 12px 16px 16px',
          background: config.color, marginTop: -4,
          opacity: 0.9,
        }} />
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#f1f5f9' }}>{name}</div>
        <div style={{ fontSize: 13, color: statusColor, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, display: 'inline-block' }} />
          {statusLabel}
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>
        3D view not available on this device
      </div>
    </div>
  )
}

// ── Types ──────────────────────────────────────────────────────

export type AgentStatus = 'active' | 'idle' | 'sleeping'

// ── Camera Button (for chat header) ────────────────────────────

export function AgentCameraButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.05)',
        color: '#94a3b8', cursor: 'pointer',
        flexShrink: 0, transition: 'all 0.15s',
      }}
    >
      <Camera size={16} />
    </button>
  )
}

// ── Fullscreen 3D Viewport Overlay ─────────────────────────────

interface AgentCameraViewProps {
  isOpen: boolean
  onClose: () => void
  agentName: string
  agentStatus: AgentStatus
  botConfig: BotVariantConfig
}

export function AgentCameraOverlay({
  isOpen,
  onClose,
  agentName,
  agentStatus,
  botConfig,
}: AgentCameraViewProps) {
  const [has3D] = useState(() => canRender3D())
  const overlayRef = useRef<HTMLDivElement>(null)

  // Prevent body scroll when overlay is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: '#0a0f1a',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(10px)',
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Camera size={16} color="#64748b" />
          <span style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>
            {agentName}
          </span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 8,
            background: agentStatus === 'active' ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)',
            color: agentStatus === 'active' ? '#22c55e' : agentStatus === 'idle' ? '#f59e0b' : '#64748b',
          }}>
            {agentStatus === 'active' ? 'Working' : agentStatus === 'idle' ? 'Idle' : 'Sleeping'}
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: 'none', background: 'rgba(255,255,255,0.08)',
            color: '#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* 3D Viewport or Static Fallback */}
      <div style={{ flex: 1, position: 'relative' }}>
        {has3D ? (
          <Suspense fallback={
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#475569', fontSize: 14,
            }}>
              Loading 3D view…
            </div>
          }>
            <AgentScene3D
              botConfig={botConfig}
              agentName={agentName}
              agentStatus={agentStatus}
            />
          </Suspense>
        ) : (
          <StaticAgentAvatar config={botConfig} name={agentName} status={agentStatus} />
        )}
      </div>
    </div>
  )
}

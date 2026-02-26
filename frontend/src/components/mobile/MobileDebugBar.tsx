/**
 * MobileDebugBar – compact status strip shown at the bottom of the screen
 * when debug mode is enabled. Shows SSE connection state, API base URL,
 * Tauri detection and app version.
 */

import { useSSEStatus } from '@/hooks/useSSEStatus'
import { API_BASE } from '@/lib/api'

const VAR_MOBILE_BORDER = 'var(--mobile-border, rgba(255,255,255,0.1))'

const APP_VERSION = '0.12.0'

function isTauri(): boolean {
  return (
    (window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined
  )
}

const STATE_COLORS: Record<string, string> = {
  connected: '#22c55e',
  connecting: '#f59e0b',
  disconnected: '#ef4444',
}

const STATE_ICONS: Record<string, string> = {
  connected: '●',
  connecting: '◌',
  disconnected: '○',
}

interface MobileDebugBarProps {
  /** Whether debug mode is active (bar is shown only when true) */
  readonly enabled: boolean
}

export function MobileDebugBar({ enabled }: MobileDebugBarProps) {
  const sseState = useSSEStatus()

  if (!enabled) return null

  const stateColor = STATE_COLORS[sseState] ?? '#94a3b8'
  const stateIcon = STATE_ICONS[sseState] ?? '?'
  const inTauri = isTauri()

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9990,
        background: 'var(--mobile-surface, rgba(15,23,42,0.95))',
        borderTop: '1px solid var(--mobile-border, rgba(255,255,255,0.08))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '4px 12px',
        paddingBottom: 'calc(4px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        fontSize: 10,
        fontFamily: 'monospace',
        color: '#64748b',
        userSelect: 'none',
      }}
    >
      {/* SSE status */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: stateColor, fontSize: 12 }}>{stateIcon}</span>
        <span style={{ color: stateColor }}>SSE: {sseState}</span>
      </span>

      <span style={{ color: VAR_MOBILE_BORDER }}>│</span>

      {/* API base */}
      <span
        style={{
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        API: {API_BASE}
      </span>

      <span style={{ color: VAR_MOBILE_BORDER }}>│</span>

      {/* Tauri */}
      <span style={{ color: inTauri ? '#a78bfa' : '#475569' }}>
        Tauri: {inTauri ? 'yes' : 'no'}
      </span>

      <span style={{ color: VAR_MOBILE_BORDER }}>│</span>

      {/* Version */}
      <span>v{APP_VERSION}</span>
    </div>
  )
}

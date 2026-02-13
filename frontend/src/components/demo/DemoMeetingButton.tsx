/**
 * DemoMeetingButton — Prominent "Watch a Demo Meeting" button for HQ room.
 *
 * Only rendered in demo mode (VITE_DEMO_MODE=true).
 * Triggers a fake meeting flow with scripted agent contributions.
 */

import { useState } from 'react'
import { Play, Loader2 } from 'lucide-react'

interface DemoMeetingButtonProps {
  onClick: () => void
  isActive: boolean
  isComplete: boolean
}

export function DemoMeetingButton({ onClick, isActive, isComplete }: DemoMeetingButtonProps) {
  const [hovered, setHovered] = useState(false)

  if (isComplete) return null

  return (
    <button
      onClick={onClick}
      disabled={isActive}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: `translateX(-50%) scale(${hovered && !isActive ? 1.05 : 1})`,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 28px',
        borderRadius: '16px',
        border: '2px solid rgba(99, 102, 241, 0.4)',
        background: isActive
          ? 'rgba(99, 102, 241, 0.6)'
          : hovered
            ? 'rgba(99, 102, 241, 0.95)'
            : 'rgba(99, 102, 241, 0.85)',
        color: '#fff',
        fontSize: '16px',
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        cursor: isActive ? 'default' : 'pointer',
        backdropFilter: 'blur(12px)',
        boxShadow: hovered && !isActive
          ? '0 8px 32px rgba(99, 102, 241, 0.5), 0 0 60px rgba(99, 102, 241, 0.2)'
          : '0 4px 20px rgba(99, 102, 241, 0.35)',
        transition: 'all 0.2s ease',
        animation: isActive ? 'none' : 'demo-btn-pulse 3s ease-in-out infinite',
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      {isActive ? (
        <>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Meeting in Progress…</span>
        </>
      ) : (
        <>
          <Play size={20} fill="currentColor" />
          <span>▶️ Watch a Demo Meeting</span>
        </>
      )}
      <style>{`
        @keyframes demo-btn-pulse {
          0%, 100% { box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35); }
          50% { box-shadow: 0 4px 30px rgba(99, 102, 241, 0.55), 0 0 40px rgba(99, 102, 241, 0.15); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  )
}

import { useState, useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useWorldFocus } from '@/contexts/WorldFocusContext'

interface RoomNameplateProps {
  name: string
  icon?: string | null
  color?: string
  size?: number
  hovered?: boolean
  projectName?: string | null
  projectColor?: string | null
  isHQ?: boolean
}

// ─── Constants ─────────────────────────────────────────────────

const FLOOR_TOP = 0.16
const WALL_HEIGHT = 1.5
const NAMEPLATE_Y_OFFSET = 1.2 // how far above the wall top the nameplate floats

/**
 * Floating HTML nameplate above each room.
 *
 * Uses drei's <Html> (screen-space, no distanceFactor) for crisp,
 * always-camera-facing text at a consistent size regardless of zoom.
 * Includes:
 * - Room emoji + name (always visible)
 * - Project/HQ subtitle (revealed on hover with smooth transition)
 * - Hidden at room-level zoom (level !== 'overview')
 */
export function RoomNameplate({
  name,
  icon,
  color,
  size: _size = 12,
  hovered: _roomHovered = false,
  projectName,
  projectColor,
  isHQ = false,
}: RoomNameplateProps) {
  const accentColor = color || '#4f46e5'
  const { state } = useWorldFocus()
  const [labelHovered, setLabelHovered] = useState(false)

  // ─── Subtitle logic (hooks MUST be called before any early return) ──
  const { subtitleText, subtitleColor } = useMemo(() => {
    if (isHQ) {
      return { subtitleText: '★ COMMAND CENTER', subtitleColor: '#FFD700' }
    }
    if (projectName) {
      return { subtitleText: `● ${projectName}`, subtitleColor: projectColor || '#94a3b8' }
    }
    return { subtitleText: 'GENERAL', subtitleColor: '#94a3b8' }
  }, [isHQ, projectName, projectColor])

  // ─── Hide when zoomed into a room (level !== overview) ──────
  // (after all hooks to respect Rules of Hooks)
  const isOverview = state.level === 'overview'
  if (!isOverview) return null

  // ─── Position: floating above the room center ───────────────
  const posY = FLOOR_TOP + WALL_HEIGHT + NAMEPLATE_Y_OFFSET

  return (
    <Html
      position={[0, posY, 0]}
      center
      zIndexRange={[10, 20]}
      style={{ pointerEvents: 'auto' }}
      // No distanceFactor → screen-space sized, consistent at any zoom level
    >
      <div
        onPointerEnter={() => setLabelHovered(true)}
        onPointerLeave={() => setLabelHovered(false)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          userSelect: 'none',
          cursor: 'default',
          // Prevent the HTML overlay from capturing room clicks
          pointerEvents: 'auto',
        }}
      >
        {/* ── Main label (emoji + name) ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(15, 15, 25, 0.75)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            padding: '4px 12px',
            borderRadius: '8px',
            border: `1.5px solid ${accentColor}55`,
            boxShadow: `0 2px 12px rgba(0,0,0,0.35), inset 0 0 8px ${accentColor}18`,
          }}
        >
          {icon && (
            <span style={{ fontSize: '14px', lineHeight: 1 }}>{icon}</span>
          )}
          <span
            style={{
              color: '#f1f5f9',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '0.5px',
              textShadow: `0 1px 3px rgba(0,0,0,0.5), 0 0 8px ${accentColor}40`,
              whiteSpace: 'nowrap',
            }}
          >
            {name.toUpperCase()}
          </span>
        </div>

        {/* ── Subtitle (project / HQ / general) — hidden by default, revealed on hover ── */}
        <div
          style={{
            background: 'rgba(15, 15, 25, 0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            padding: '1px 8px',
            borderRadius: '5px',
            opacity: labelHovered ? 0.85 : 0,
            transform: labelHovered ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'opacity 0.25s ease, transform 0.25s ease',
            pointerEvents: labelHovered ? 'auto' : 'none',
          }}
        >
          <span
            style={{
              color: subtitleColor,
              fontSize: '9px',
              fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              letterSpacing: '0.4px',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitleText}
          </span>
        </div>
      </div>
    </Html>
  )
}

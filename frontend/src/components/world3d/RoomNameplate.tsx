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
const ACCENT_HEIGHT = 0.15

/**
 * Subtle fixed-orientation nameplate floating above the room entrance.
 *
 * Uses drei's <Html transform> for world-space rendering with a fixed
 * orientation — NO billboarding. Positioned above the front door gap
 * on the -Z wall, slightly tilted upward for readability from the
 * isometric camera at [-45, 40, -45].
 *
 * Design: minimal elegant sign — no dark background, normal case text,
 * thin accent gradient line, light colors with text shadow for readability.
 *
 * Includes:
 * - Room emoji + name (always visible)
 * - Project/HQ subtitle (revealed on hover with smooth transition)
 * - Hidden when zoomed into a room (level !== 'overview')
 */
export function RoomNameplate({
  name,
  icon,
  color,
  size = 12,
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
      return { subtitleText: '★ Command Center', subtitleColor: '#FFD700' }
    }
    if (projectName) {
      return { subtitleText: `● ${projectName}`, subtitleColor: projectColor || '#94a3b8' }
    }
    return { subtitleText: 'General', subtitleColor: '#94a3b8' }
  }, [isHQ, projectName, projectColor])

  // ─── Hide when zoomed into a room ───────────────────────────
  const isOverview = state.level === 'overview'
  if (!isOverview) return null

  // ─── Position: above the front door gap (-Z wall center) ────
  // The front wall has a centered gap (gapWidth=3) for the door.
  // Nameplate floats just above the accent strip at the wall top.
  const halfSize = size / 2
  const posY = FLOOR_TOP + WALL_HEIGHT + ACCENT_HEIGHT + 0.35
  const posZ = -halfSize

  return (
    <group
      position={[0, posY, posZ]}
      // Face -Z (toward isometric camera) with a slight upward tilt (~14°)
      // so the sign is more readable from the elevated camera angle.
      // Euler XYZ: tilt around X first, then flip around Y to face -Z.
      rotation={[-0.25, Math.PI, 0]}
    >
      <Html
        transform
        center
        // At distanceFactor=60, the HTML appears at natural CSS pixel size
        // when the camera is 60 units away. At the default overview distance
        // (~75 units) the text is slightly smaller — subtle and proportional.
        distanceFactor={60}
        style={{ pointerEvents: 'auto' }}
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
            pointerEvents: 'auto',
          }}
        >
          {/* ── Main label (emoji + name) ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
            }}
          >
            {icon && (
              <span style={{ fontSize: '11px', lineHeight: 1, opacity: 0.75 }}>
                {icon}
              </span>
            )}
            <span
              style={{
                color: '#e2e8f0',
                fontSize: '11px',
                fontWeight: 500,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.3px',
                textShadow: `0 1px 3px rgba(0,0,0,0.5), 0 0 8px ${accentColor}30`,
                whiteSpace: 'nowrap',
              }}
            >
              {name}
            </span>
          </div>

          {/* ── Thin accent gradient line ── */}
          <div
            style={{
              width: '70%',
              height: '1px',
              background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)`,
              borderRadius: '1px',
            }}
          />

          {/* ── Subtitle (project / HQ / general) — revealed on hover ── */}
          <div
            style={{
              padding: '1px 6px',
              opacity: labelHovered ? 0.75 : 0,
              transform: labelHovered ? 'translateY(0)' : 'translateY(-2px)',
              transition: 'opacity 0.2s ease, transform 0.2s ease',
              pointerEvents: labelHovered ? 'auto' : 'none',
            }}
          >
            <span
              style={{
                color: subtitleColor,
                fontSize: '8px',
                fontWeight: 500,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.2px',
                whiteSpace: 'nowrap',
              }}
            >
              {subtitleText}
            </span>
          </div>
        </div>
      </Html>
    </group>
  )
}

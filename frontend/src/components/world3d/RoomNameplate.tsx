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

/**
 * Subtle nameplate floating above the room center.
 * 
 * Uses <Html> in screen-space (no transform) so it stays readable at any
 * camera angle, but with a small fixed size that doesn't dominate the scene.
 * NOT billboard — we use `transform` with a flat horizontal rotation
 * so it doesn't rotate with the camera.
 * 
 * Design: small semi-transparent pill, normal case, room color accent.
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

  const { subtitleText, subtitleColor } = useMemo(() => {
    if (isHQ) return { subtitleText: '★ Command Center', subtitleColor: '#FFD700' }
    if (projectName) return { subtitleText: `● ${projectName}`, subtitleColor: projectColor || '#94a3b8' }
    return { subtitleText: null, subtitleColor: '#94a3b8' }
  }, [isHQ, projectName, projectColor])

  // Hide when zoomed into a room or bot
  if (state.level !== 'overview') return null

  // Float above room center
  const posY = 2.8

  return (
    <group position={[0, posY, 0]}>
      <Html
        center
        // Screen-space: stays same size regardless of zoom
        // No distanceFactor = fixed pixel size on screen
        zIndexRange={[1, 5]}
        style={{ pointerEvents: 'auto' }}
      >
        <div
          onPointerEnter={() => setLabelHovered(true)}
          onPointerLeave={() => setLabelHovered(false)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            userSelect: 'none',
            cursor: 'default',
          }}
        >
          {/* Main label */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 10px',
              borderRadius: 6,
              background: 'rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(4px)',
              borderBottom: `2px solid ${accentColor}80`,
            }}
          >
            {icon && (
              <span style={{ fontSize: 10, lineHeight: 1 }}>{icon}</span>
            )}
            <span
              style={{
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: 11,
                fontWeight: 600,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.2px',
                whiteSpace: 'nowrap',
                lineHeight: '18px',
              }}
            >
              {name}
            </span>
          </div>

          {/* Subtitle (project / HQ) — on hover only */}
          {subtitleText && (
            <div
              style={{
                padding: '1px 8px',
                borderRadius: 4,
                background: labelHovered ? 'rgba(0, 0, 0, 0.3)' : 'transparent',
                opacity: labelHovered ? 1 : 0,
                transform: labelHovered ? 'translateY(0) scale(1)' : 'translateY(-4px) scale(0.9)',
                transition: 'all 0.2s ease',
                pointerEvents: labelHovered ? 'auto' : 'none',
              }}
            >
              <span
                style={{
                  color: subtitleColor,
                  fontSize: 9,
                  fontWeight: 500,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  whiteSpace: 'nowrap',
                }}
              >
                {subtitleText}
              </span>
            </div>
          )}
        </div>
      </Html>
    </group>
  )
}

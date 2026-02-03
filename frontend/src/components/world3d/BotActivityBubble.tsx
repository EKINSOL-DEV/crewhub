import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import type { BotStatus } from './Bot3D'

interface BotActivityBubbleProps {
  /** Current activity text to display */
  activity: string
  /** Bot status */
  status: BotStatus
  /** Whether the bot is actively running (tokens changing recently) */
  isActive: boolean
}

/** Max characters before truncating with ellipsis */
const MAX_CHARS = 30

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1) + '…'
}

/**
 * Floating activity/status bubble above a bot's head.
 * Shows what the bot is currently doing (tool calls, thinking, label, idle).
 * Uses Html from drei so it renders as a DOM overlay scaled with distance.
 */
export function BotActivityBubble({ activity, status, isActive }: BotActivityBubbleProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [visible, setVisible] = useState(false)
  const [displayText, setDisplayText] = useState(activity)

  // Fade in on mount, update text with brief fade
  useEffect(() => {
    // Small delay before showing to allow fade-in
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // When activity text changes, update display
  useEffect(() => {
    setDisplayText(activity)
  }, [activity])

  // Subtle float animation (slower than the bot's own bob)
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    // Gentle oscillation: ~0.02 units amplitude, slow period
    groupRef.current.position.y = 0.88 + Math.sin(t * 1.8) * 0.02
  })

  const isIdle = status === 'idle' && !isActive
  const label = truncate(displayText, MAX_CHARS)

  return (
    <group ref={groupRef} position={[0, 0.88, 0]}>
      <Html
        center
        distanceFactor={15}
        zIndexRange={[1, 5]}
        style={{
          pointerEvents: 'none',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Bubble */}
          <div
            style={{
              background: isIdle ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.92)',
              border: '1px solid rgba(0,0,0,0.08)',
              borderRadius: '6px',
              padding: '3px 8px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
              whiteSpace: 'nowrap',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '10px',
              fontWeight: isIdle ? 400 : 500,
              color: isIdle ? '#9ca3af' : '#374151',
              lineHeight: '1.3',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: isIdle ? 0.7 : 1,
            }}
          >
            {label}
          </div>
          {/* Tail / pointer triangle */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderTop: isIdle
                ? '4px solid rgba(255,255,255,0.75)'
                : '4px solid rgba(255,255,255,0.92)',
              marginTop: '-1px',
            }}
          />
        </div>
      </Html>
    </group>
  )
}

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
const MAX_CHARS = 40

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  // Try to break at a word boundary
  const trimmed = text.slice(0, max - 1)
  const lastSpace = trimmed.lastIndexOf(' ')
  if (lastSpace > max * 0.6) {
    return trimmed.slice(0, lastSpace) + '…'
  }
  return trimmed + '…'
}

/** Dynamic font size: shorter text gets larger font, longer text shrinks */
function getFontSize(textLength: number): string {
  if (textLength <= 15) return '10px'
  if (textLength <= 25) return '9.5px'
  return '9px'
}

/**
 * Floating activity/status bubble above a bot's head.
 * Shows what the bot is currently doing — task summary, tool calls, thinking, or idle.
 * Uses Html from drei so it renders as a DOM overlay scaled with distance.
 */
export function BotActivityBubble({ activity, status, isActive }: BotActivityBubbleProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [visible, setVisible] = useState(false)
  const [displayText, setDisplayText] = useState(activity)
  const [textOpacity, setTextOpacity] = useState(1)

  // Fade in on mount
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // When activity text changes, animate with a subtle fade
  useEffect(() => {
    if (activity === displayText) return
    // Fade out → swap text → fade in
    setTextOpacity(0)
    const timer = setTimeout(() => {
      setDisplayText(activity)
      setTextOpacity(1)
    }, 150)
    return () => clearTimeout(timer)
  }, [activity, displayText])

  // Subtle float animation (slower than the bot's own bob)
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.position.y = 0.88 + Math.sin(t * 1.8) * 0.02
  })

  const isIdle = status === 'idle' && !isActive
  const label = truncate(displayText, MAX_CHARS)
  const fontSize = getFontSize(label.length)

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
              fontSize,
              fontWeight: isIdle ? 400 : 500,
              color: isIdle ? '#9ca3af' : '#374151',
              lineHeight: '1.3',
              maxWidth: '200px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: isIdle ? 0.7 : textOpacity,
              transition: 'opacity 0.15s ease-in-out, font-size 0.2s ease',
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

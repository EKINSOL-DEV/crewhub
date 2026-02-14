import { useRef } from 'react'
import { useThrottledFrame } from './utils/useThrottledFrame'
import * as THREE from 'three'

interface BotStatusGlowProps {
  status: 'active' | 'idle' | 'sleeping' | 'supervising' | 'offline' | 'meeting'
}

const STATUS_GLOW_COLOR: Record<string, string> = {
  active: '#4ade80',  // green
  idle: '#fbbf24',    // yellow
  supervising: '#a78bfa', // purple
  meeting: '#0ea5e9',   // sky blue
  sleeping: '#9ca3af', // gray
  offline: '#6b7280',  // dark gray
}

/**
 * Ground glow ring under the bot indicating its status.
 * - Green pulse = active/working
 * - Yellow steady = idle
 * - Gray dim = sleeping/offline
 */
export function BotStatusGlow({ status }: BotStatusGlowProps) {
  const glowRef = useRef<THREE.Mesh>(null)
  const glowColor = STATUS_GLOW_COLOR[status] || STATUS_GLOW_COLOR.offline

  useThrottledFrame(({ clock }) => {
    if (!glowRef.current) return
    const mat = glowRef.current.material as THREE.MeshStandardMaterial
    const t = clock.getElapsedTime()

    switch (status) {
      case 'active':
        // Pulsing glow
        mat.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.3
        mat.opacity = 0.7 + Math.sin(t * 3) * 0.2
        break
      case 'idle':
        // Steady glow
        mat.emissiveIntensity = 0.4
        mat.opacity = 0.6
        break
      case 'supervising':
        // Slow pulse — watching over subagents
        mat.emissiveIntensity = 0.4 + Math.sin(t * 1.5) * 0.2
        mat.opacity = 0.6 + Math.sin(t * 1.5) * 0.15
        break
      case 'sleeping':
      case 'offline':
        // Dim glow
        mat.emissiveIntensity = 0.15
        mat.opacity = 0.3
        break
    }
  }, 3)

  return (
    <mesh
      ref={glowRef}
      position={[0, -0.34, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[0.22, 0.34, 24]} />
      <meshStandardMaterial
        color={glowColor}
        emissive={glowColor}
        emissiveIntensity={0.4}
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, Text } from '@react-three/drei'
import * as THREE from 'three'
import { BotBody } from './BotBody'
import { BotFace } from './BotFace'
import { BotAccessory } from './BotAccessory'
import { BotStatusGlow } from './BotStatusGlow'
import type { BotVariantConfig } from './utils/botVariants'

export type BotStatus = 'active' | 'idle' | 'sleeping' | 'offline'

interface Bot3DProps {
  /** Position in 3D space (bot bottom on floor) */
  position: [number, number, number]
  /** Bot variant config (color, accessory type, etc.) */
  config: BotVariantConfig
  /** Current status */
  status: BotStatus
  /** Display name shown below bot */
  name: string
  /** Scale factor (1.0 = main agent, 0.6 = subagent) */
  scale?: number
}

/**
 * Complete 3D bot character with body, face, accessory, status glow,
 * animations, and floating name tag.
 */
export function Bot3D({ position, config, status, name, scale = 1.0 }: Bot3DProps) {
  const groupRef = useRef<THREE.Group>(null)

  // Animations based on status
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // Reset transforms each frame
    groupRef.current.rotation.z = 0
    groupRef.current.rotation.x = 0

    switch (status) {
      case 'active':
        // Faster bobbing + slight rotation (working)
        groupRef.current.position.y = position[1] + Math.sin(t * 4) * 0.06
        groupRef.current.rotation.y = Math.sin(t * 2) * 0.15
        break
      case 'idle':
        // Gentle bobbing
        groupRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.03
        groupRef.current.rotation.y = Math.sin(t * 0.4) * 0.2
        break
      case 'sleeping':
        // Slow movement, tilted
        groupRef.current.position.y = position[1] + Math.sin(t * 0.8) * 0.015
        groupRef.current.rotation.z = 0.12 // tilted
        groupRef.current.rotation.x = 0.05
        break
      case 'offline':
        // Static, no animation
        groupRef.current.position.y = position[1]
        break
    }
  })

  // Offset y so that bot feet (~-0.35 local) rest on the floor position
  const yOffset = 0.38

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1], position[2]]}
      scale={scale}
    >
      {/* Offset group to put feet on the floor */}
      <group position={[0, yOffset, 0]}>
        {/* Status glow ring (on ground) */}
        <BotStatusGlow status={status} />

        {/* Body (capsule + arms + feet) */}
        <BotBody color={config.color} status={status} />

        {/* Face (eyes + mouth) */}
        <BotFace status={status} />

        {/* Accessory (type-specific) */}
        <BotAccessory type={config.accessory} color={config.color} />

        {/* Sleeping ZZZ text */}
        {status === 'sleeping' && <SleepingZs />}

        {/* Name tag */}
        <Html
          position={[0, -0.55, 0]}
          center
          distanceFactor={15}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              fontFamily: 'system-ui, sans-serif',
              textAlign: 'center',
              maxWidth: '120px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {name}
          </div>
        </Html>
      </group>
    </group>
  )
}

// ─── Sleeping ZZZ ──────────────────────────────────────────────

function SleepingZs() {
  const zRefs = useRef<THREE.Group[]>([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    zRefs.current.forEach((ref, i) => {
      if (!ref) return
      const phase = (t * 0.6 + i * 1.2) % 3
      ref.position.y = 0.7 + phase * 0.25
      ref.position.x = Math.sin(t + i) * 0.12
      const opacity = phase < 2.5 ? 0.8 : Math.max(0, 0.8 - (phase - 2.5) * 1.6)
      ref.scale.setScalar(0.5 + phase * 0.12)
      ref.children.forEach(child => {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
        if (mat && mat.opacity !== undefined) mat.opacity = opacity
      })
    })
  })

  return (
    <group>
      {[0, 1, 2].map(i => (
        <group key={i} ref={el => { if (el) zRefs.current[i] = el }}>
          <Text
            fontSize={0.1}
            color="#9ca3af"
            anchorX="center"
            anchorY="middle"
            material-transparent
            material-opacity={0.8}
          >
            Z
          </Text>
        </group>
      ))}
    </group>
  )
}

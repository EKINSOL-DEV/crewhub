import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CREATOR_CENTER } from '@/lib/zones'
import { ZoneLandingView } from './ZoneLandingView'
import { BotBody } from './BotBody'
import { BotFace } from './BotFace'
import { BotAccessory } from './BotAccessory'
import { BotChestDisplay } from './BotChestDisplay'
import { Html } from '@react-three/drei'

const MVP_ITEMS = [
  { emoji: '🖌️', label: 'Asset Library' },
  { emoji: '🏗️', label: 'Room Builder' },
  { emoji: '🎭', label: 'Prop Designer' },
  { emoji: '🌍', label: 'Environment Editor' },
  { emoji: '📤', label: 'Share & Export' },
]

/**
 * Animated builder bot for the Creator Center zone.
 * Has a gentle bobbing idle animation and a spinning gear accessory.
 */
function BuilderBot() {
  const groupRef = useRef<THREE.Group>(null!)
  const armRef = useRef<THREE.Group>(null!)

  useFrame(() => {
    if (!groupRef.current) return
    // Gentle idle bob
    const t = performance.now() * 0.001
    groupRef.current.position.y = 0.35 + Math.sin(t * 1.5) * 0.08
    // Slight body sway
    groupRef.current.rotation.z = Math.sin(t * 1.2) * 0.03

    // Arm swing (hammer motion)
    if (armRef.current) {
      armRef.current.rotation.x = Math.sin(t * 3) * 0.4 - 0.2
    }
  })

  return (
    <group position={[-4, 0, -2]}>
      <group ref={groupRef} scale={1.3}>
        {/* Bot body */}
        <BotBody color="#f59e0b" status="active" />
        <BotFace expression="happy" status="active" />
        <BotAccessory type="gear" color="#f59e0b" />
        <BotChestDisplay type="tool" color="#f59e0b" />

        {/* Hammer arm */}
        <group ref={armRef} position={[0.55, 0.3, 0]}>
          {/* Arm */}
          <mesh position={[0.15, -0.15, 0]}>
            <boxGeometry args={[0.12, 0.35, 0.12]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          {/* Hammer handle */}
          <mesh position={[0.15, -0.45, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.3, 8]} />
            <meshStandardMaterial color="#8B4513" />
          </mesh>
          {/* Hammer head */}
          <mesh position={[0.15, -0.62, 0]}>
            <boxGeometry args={[0.18, 0.1, 0.1]} />
            <meshStandardMaterial color="#6B7280" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>

        {/* Activity bubble */}
        <Html position={[0, 1.6, 0]} center>
          <div style={{
            background: 'rgba(245, 158, 11, 0.9)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '8px',
            fontFamily: 'system-ui',
            fontSize: '11px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            🔨 Building tools...
          </div>
        </Html>
      </group>

      {/* Small pedestal */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.8, 0.9, 0.3, 16]} />
        <meshStandardMaterial color="#d97706" />
      </mesh>

      {/* Name label */}
      <Html position={[0, -0.6, 0]} center>
        <div style={{
          color: '#fbbf24',
          fontFamily: 'system-ui',
          fontSize: '11px',
          fontWeight: 'bold',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}>
          Builder Bot
        </div>
      </Html>
    </group>
  )
}

interface CreatorCenterViewProps {
  className?: string
}

export function CreatorCenterView({ className }: CreatorCenterViewProps) {
  return (
    <ZoneLandingView
      zone={CREATOR_CENTER}
      mvpItems={MVP_ITEMS}
      className={className}
      sceneExtras={<BuilderBot />}
    />
  )
}

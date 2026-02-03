import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import type { BotChestType } from './utils/botVariants'

interface BotChestDisplayProps {
  type: BotChestType
  color: string
}

/**
 * Per-type chest display / icon on the bot's body.
 * Positioned on the front of the body (y ≈ 0.02, z = front face).
 *
 * - Worker: scissor/wrench tool icon
 * - Thinker: three dots on lower body
 * - Cron: "12:00" digital clock display
 * - Comms: "..." chat dots
 * - Dev: "</>" code display
 */
export function BotChestDisplay({ type, color }: BotChestDisplayProps) {
  const displayY = 0.0   // On the body (body center = -0.02)
  const displayZ = 0.18  // Front face of body (pushed forward to avoid clipping)

  return (
    <group position={[0, displayY, displayZ]}>
      {type === 'tool' && <ToolIcon />}
      {type === 'dots' && <ThreeDotsIcon color={color} />}
      {type === 'clock-display' && <ClockDisplay />}
      {type === 'chat-dots' && <ChatDotsIcon />}
      {type === 'code' && <CodeDisplay />}
    </group>
  )
}

// ─── Worker: Tool/scissor icon ─────────────────────────────────

function ToolIcon() {
  return (
    <group>
      {/* Wrench/cross tool shape */}
      <mesh rotation={[0, 0, 0.7]}>
        <boxGeometry args={[0.08, 0.015, 0.004]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh rotation={[0, 0, -0.7]}>
        <boxGeometry args={[0.08, 0.015, 0.004]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Center pivot */}
      <mesh position={[0, 0, 0.002]}>
        <circleGeometry args={[0.01, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  )
}

// ─── Thinker: Three dots (buttons on lower body) ───────────────

function ThreeDotsIcon({ color }: { color: string }) {
  const dotColor = new THREE.Color(color).multiplyScalar(1.3)
  const hex = '#' + dotColor.getHexString()
  return (
    <group position={[0, -0.12, 0]}>
      {[-0.04, 0, 0.04].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]}>
          <circleGeometry args={[0.018, 10]} />
          <meshStandardMaterial color={hex} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Cron: Digital clock display "12:00" ───────────────────────

function ClockDisplay() {
  return (
    <group>
      {/* Dark background panel */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[0.18, 0.09]} />
        <meshStandardMaterial color="#1a3a0a" />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, -0.003]}>
        <planeGeometry args={[0.20, 0.11]} />
        <meshStandardMaterial color="#4a6a1a" />
      </mesh>
      {/* "12:00" text */}
      <Text
        position={[0, 0, 0.001]}
        fontSize={0.055}
        color="#7fff00"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        12:00
      </Text>
    </group>
  )
}

// ─── Comms: Chat dots "..." ────────────────────────────────────

function ChatDotsIcon() {
  return (
    <group>
      {[-0.035, 0, 0.035].map((x, i) => (
        <AnimatedDot key={i} x={x} delay={i * 0.4} />
      ))}
    </group>
  )
}

function AnimatedDot({ x, delay }: { x: number; delay: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    // Subtle bounce animation
    ref.current.position.y = Math.sin((t + delay) * 2.5) * 0.008
  })

  return (
    <mesh ref={ref} position={[x, 0, 0]}>
      <circleGeometry args={[0.016, 10]} />
      <meshStandardMaterial color="white" />
    </mesh>
  )
}

// ─── Dev: Code display "</>" ───────────────────────────────────

function CodeDisplay() {
  return (
    <group>
      {/* Dark background panel */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[0.20, 0.09]} />
        <meshStandardMaterial color="#2a0a0a" />
      </mesh>
      {/* Border */}
      <mesh position={[0, 0, -0.003]}>
        <planeGeometry args={[0.22, 0.11]} />
        <meshStandardMaterial color="#5a1a1a" />
      </mesh>
      {/* "</> {}" text */}
      <Text
        position={[0, 0, 0.001]}
        fontSize={0.042}
        color="#ff6b6b"
        anchorX="center"
        anchorY="middle"
        font={undefined}
      >
        {'</> {}'}
      </Text>
    </group>
  )
}

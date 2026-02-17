/**
 * ChatHeader3DScene — Minimal Three.js scene for the chat header avatar.
 * Full-body bot preview: head + torso + arms + legs + feet.
 * Camera positioned to show the entire character in a small portrait canvas.
 * Not interactive — purely decorative.
 */
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentStatus } from './AgentCameraView'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'

// ── Full-body Bot (head + torso + arms + legs + feet) ──────────

function HeaderBot({ config, status }: { config: BotVariantConfig; status: AgentStatus }) {
  const groupRef = useRef<THREE.Group>(null)
  const darkColor = new THREE.Color(config.color).multiplyScalar(0.65)
  const darkHex = '#' + darkColor.getHexString()
  const footColor = new THREE.Color(config.color).multiplyScalar(0.5)
  const footHex = '#' + footColor.getHexString()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    if (status === 'active') {
      // Subtle working bob
      groupRef.current.position.y = Math.sin(t * 2) * 0.01
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.06
    } else if (status === 'sleeping') {
      const breathe = 1 + Math.sin(t * 0.8) * 0.006
      groupRef.current.scale.set(1, breathe, 1)
      groupRef.current.rotation.z = 0.06
      groupRef.current.rotation.y = 0
    } else {
      // Idle: gentle sway
      groupRef.current.position.y = Math.sin(t * 1.2) * 0.006
      groupRef.current.rotation.y = Math.sin(t * 0.25) * 0.08
      groupRef.current.rotation.z = 0
    }
  })

  const glowColor = status === 'active' ? '#22c55e' : status === 'idle' ? '#f59e0b' : '#6366f1'

  return (
    // Centered slightly above origin so feet are near y=-0.6 (in object space)
    <group ref={groupRef} position={[0, 0.06, 0]} scale={2.2}>
      {/* ── Head ── */}
      <group position={[0, 0.34, 0]}>
        <RoundedBox args={[0.34, 0.30, 0.30]} radius={0.07} smoothness={3}>
          <meshToonMaterial color={config.color} />
        </RoundedBox>
        {/* Eyes */}
        <mesh position={[-0.08, 0.01, 0.155]}>
          <circleGeometry args={[0.055, 14]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[-0.08, 0.01, 0.16]}>
          <circleGeometry args={[0.028, 10]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.08, 0.01, 0.155]}>
          <circleGeometry args={[0.055, 14]} />
          <meshStandardMaterial color="white" />
        </mesh>
        <mesh position={[0.08, 0.01, 0.16]}>
          <circleGeometry args={[0.028, 10]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Mouth — tiny smile */}
        <mesh position={[0, -0.045, 0.16]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.026, 0.007, 6, 10, Math.PI]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>

      {/* ── Body ── */}
      <RoundedBox args={[0.38, 0.26, 0.30]} radius={0.06} smoothness={3} position={[0, 0.0, 0]}>
        <meshToonMaterial color={config.color} />
      </RoundedBox>

      {/* ── Waist / Lower body ── */}
      <RoundedBox args={[0.34, 0.10, 0.28]} radius={0.04} smoothness={3} position={[0, -0.16, 0]}>
        <meshToonMaterial color={darkHex} />
      </RoundedBox>

      {/* ── Arms ── */}
      <mesh position={[-0.25, 0.02, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.038, 0.13, 4, 6]} />
        <meshToonMaterial color={config.color} />
      </mesh>
      <mesh position={[0.25, 0.02, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.038, 0.13, 4, 6]} />
        <meshToonMaterial color={config.color} />
      </mesh>

      {/* ── Legs ── */}
      <mesh position={[-0.10, -0.30, 0]}>
        <capsuleGeometry args={[0.045, 0.10, 4, 6]} />
        <meshToonMaterial color={darkHex} />
      </mesh>
      <mesh position={[0.10, -0.30, 0]}>
        <capsuleGeometry args={[0.045, 0.10, 4, 6]} />
        <meshToonMaterial color={darkHex} />
      </mesh>

      {/* ── Feet ── */}
      <RoundedBox args={[0.12, 0.07, 0.16]} radius={0.03} smoothness={2} position={[-0.10, -0.40, 0.03]}>
        <meshToonMaterial color={footHex} />
      </RoundedBox>
      <RoundedBox args={[0.12, 0.07, 0.16]} radius={0.03} smoothness={2} position={[0.10, -0.40, 0.03]}>
        <meshToonMaterial color={footHex} />
      </RoundedBox>

      {/* ── Status glow ring (floor) ── */}
      <mesh position={[0, -0.47, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.24, 20]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={0.7}
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// ── Scene export ───────────────────────────────────────────────

interface ChatHeader3DSceneProps {
  botConfig: BotVariantConfig
  agentStatus: AgentStatus
}

export default function ChatHeader3DScene({ botConfig, agentStatus }: ChatHeader3DSceneProps) {
  // Camera positioned to frame the full body (head top → feet) in portrait
  // Character spans ~[-0.47*2.2, 0.50*2.2] = [-1.03, 1.10] in world y
  // Centre ≈ y = 0.035; camera at y = 0.1 looks almost straight on
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.35, 3.0], fov: 40, near: 0.1, far: 20 }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      frameloop="always"
      gl={{ antialias: true, powerPreference: 'low-power', alpha: true }}
    >
      <color attach="background" args={['#0d1626']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[2, 4, 3]} intensity={0.85} />
      <pointLight position={[-2, 2, 1]} intensity={0.3} color="#6366f1" />

      <HeaderBot config={botConfig} status={agentStatus} />
    </Canvas>
  )
}

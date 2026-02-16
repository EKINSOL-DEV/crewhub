import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentStatus } from './AgentCameraView'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'

// ── Simplified Bot (reuses design from BotBody/BotFace but inline & lighter) ──

function SimpleBotHead({ color }: { color: string }) {
  return (
    <group position={[0, 0.32, 0]}>
      {/* Head */}
      <RoundedBox args={[0.36, 0.32, 0.32]} radius={0.07} smoothness={3}>
        <meshToonMaterial color={color} />
      </RoundedBox>
      {/* Eyes */}
      <group position={[-0.09, 0.02, 0.175]}>
        <mesh><circleGeometry args={[0.06, 16]} /><meshStandardMaterial color="white" /></mesh>
        <mesh position={[0, 0, 0.005]}><circleGeometry args={[0.032, 12]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        <mesh position={[0.012, 0.012, 0.01]}><circleGeometry args={[0.01, 8]} /><meshStandardMaterial color="white" /></mesh>
      </group>
      <group position={[0.09, 0.02, 0.175]}>
        <mesh><circleGeometry args={[0.06, 16]} /><meshStandardMaterial color="white" /></mesh>
        <mesh position={[0, 0, 0.005]}><circleGeometry args={[0.032, 12]} /><meshStandardMaterial color="#1a1a1a" /></mesh>
        <mesh position={[0.012, 0.012, 0.01]}><circleGeometry args={[0.01, 8]} /><meshStandardMaterial color="white" /></mesh>
      </group>
      {/* Mouth - small smile */}
      <mesh position={[0, -0.05, 0.175]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.03, 0.008, 6, 10, Math.PI]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}

function SimpleBot({ config, status }: { config: BotVariantConfig; status: AgentStatus }) {
  const groupRef = useRef<THREE.Group>(null)
  const darkColor = new THREE.Color(config.color).multiplyScalar(0.65)
  const darkHex = '#' + darkColor.getHexString()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    if (status === 'active') {
      // Gentle bob
      groupRef.current.position.y = Math.sin(t * 2) * 0.02
      groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.15
    } else if (status === 'sleeping') {
      // Breathing
      const breathe = 1 + Math.sin(t * 0.8) * 0.008
      groupRef.current.scale.set(1, breathe, 1)
      groupRef.current.rotation.z = 0.1
    } else {
      // Idle: slow gentle sway
      groupRef.current.position.y = Math.sin(t * 1.2) * 0.01
      groupRef.current.rotation.y = Math.sin(t * 0.2) * 0.1
    }
  })

  return (
    <group ref={groupRef} position={[0, 0.33, 0]} scale={2.2}>
      <SimpleBotHead color={config.color} />
      {/* Body */}
      <RoundedBox args={[0.40, 0.28, 0.34]} radius={0.06} smoothness={3} position={[0, -0.02, 0]}>
        <meshToonMaterial color={config.color} />
      </RoundedBox>
      {/* Lower body */}
      <RoundedBox args={[0.40, 0.12, 0.34]} radius={0.04} smoothness={3} position={[0, -0.14, 0]}>
        <meshToonMaterial color={darkHex} />
      </RoundedBox>
      {/* Arms */}
      <mesh position={[-0.26, 0, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.04, 0.12, 4, 6]} /><meshToonMaterial color={config.color} />
      </mesh>
      <mesh position={[0.26, 0, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.04, 0.12, 4, 6]} /><meshToonMaterial color={config.color} />
      </mesh>
      {/* Feet */}
      <mesh position={[-0.09, -0.30, 0.03]}>
        <boxGeometry args={[0.10, 0.06, 0.13]} /><meshToonMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0.09, -0.30, 0.03]}>
        <boxGeometry args={[0.10, 0.06, 0.13]} /><meshToonMaterial color="#2a2a2a" />
      </mesh>
      {/* Status glow ring on ground */}
      <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.32, 20]} />
        <meshStandardMaterial
          color={status === 'active' ? '#22c55e' : status === 'idle' ? '#f59e0b' : '#6366f1'}
          emissive={status === 'active' ? '#22c55e' : status === 'idle' ? '#f59e0b' : '#6366f1'}
          emissiveIntensity={0.6}
          transparent opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Laptop when active */}
      {status === 'active' && (
        <group position={[0, -0.05, 0.3]} rotation={[-0.3, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.22, 0.01, 0.15]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, 0.07, -0.07]} rotation={[0.8, 0, 0]}>
            <boxGeometry args={[0.20, 0.13, 0.008]} />
            <meshStandardMaterial color="#1e40af" emissive="#1e40af" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}
    </group>
  )
}

// ── Minimal Room Floor ─────────────────────────────────────────

function SimpleRoom() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[4, 4]} />
        <meshStandardMaterial color="#1a2332" />
      </mesh>
      {/* Floor grid lines */}
      <gridHelper args={[4, 8, '#1e3a5f', '#152030']} position={[0, 0.001, 0]} />
    </group>
  )
}

// ── Main Scene ─────────────────────────────────────────────────

interface AgentScene3DProps {
  botConfig: BotVariantConfig
  agentName: string
  agentStatus: AgentStatus
}

export default function AgentScene3D({ botConfig, agentStatus }: AgentScene3DProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [1.5, 2, 2.5], fov: 45, near: 0.1, far: 20 }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      frameloop="always"
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} />
      <pointLight position={[-2, 3, -1]} intensity={0.3} color="#6366f1" />

      {/* Scene */}
      <SimpleRoom />
      <SimpleBot config={botConfig} status={agentStatus} />

      {/* Controls - touch friendly */}
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={6}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.2}
        target={[0, 0.6, 0]}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
    </Canvas>
  )
}

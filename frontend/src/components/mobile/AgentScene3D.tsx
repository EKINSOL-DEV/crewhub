import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentStatus } from './AgentCameraView'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'

// ── Expressive Bot Face ────────────────────────────────────────

function BotEye({
  position,
  status,
  side,
}: {
  readonly position: [number, number, number]
  readonly status: AgentStatus
  readonly side: 'left' | 'right'
}) {
  const pupilRef = useRef<THREE.Mesh>(null)
  const lidRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!pupilRef.current || !lidRef.current) return

    // Pupil look direction based on status
    if (status === 'active') {
      // Looking at laptop (down-center)
      pupilRef.current.position.x = side === 'left' ? 0.005 : -0.005
      pupilRef.current.position.y = -0.012
    } else if (status === 'idle') {
      // Slow random looking around
      pupilRef.current.position.x = Math.sin(t * 0.4 + (side === 'left' ? 0 : 1.5)) * 0.015
      pupilRef.current.position.y = Math.cos(t * 0.3) * 0.008
    } else {
      pupilRef.current.position.x = 0
      pupilRef.current.position.y = 0
    }

    // Eyelid (sleeping = closed, otherwise blink occasionally)
    if (status === 'sleeping') {
      lidRef.current.scale.y = 1
    } else {
      // Blink every ~4 seconds
      const blinkCycle = t % 4
      lidRef.current.scale.y = blinkCycle > 3.85 && blinkCycle < 3.95 ? 1 : 0
    }
  })

  return (
    <group position={position}>
      {/* Eye white */}
      <mesh>
        <circleGeometry args={[0.06, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Pupil */}
      <mesh ref={pupilRef} position={[0, 0, 0.005]}>
        <circleGeometry args={[0.032, 12]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      {/* Highlight */}
      <mesh position={[0.012, 0.012, 0.01]}>
        <circleGeometry args={[0.01, 8]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Eyelid (for blink/sleep) */}
      <mesh ref={lidRef} position={[0, 0.01, 0.015]} scale={[1, 0, 1]}>
        <planeGeometry args={[0.14, 0.08]} />
        <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function BotMouth({ status }: { status: AgentStatus }) {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()

    if (status === 'active') {
      // Slight concentration - flat/focused
      ref.current.scale.x = 0.8
    } else if (status === 'idle') {
      // Gentle smile
      ref.current.scale.x = 1 + Math.sin(t * 0.5) * 0.1
    } else {
      // Sleeping - relaxed open
      ref.current.scale.x = 0.7
    }
  })

  return (
    <group ref={ref} position={[0, -0.055, 0.175]}>
      {(() => {
        if (status === 'sleeping') {
          return (
            // Small "o" mouth for sleeping
            <mesh>
              <circleGeometry args={[0.015, 12]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          )
        }

        if (status === 'active') {
          return (
            // Straight focused line
            <mesh>
              <planeGeometry args={[0.05, 0.008]} />
              <meshStandardMaterial color="#333" side={THREE.DoubleSide} />
            </mesh>
          )
        }

        return (
          // Smile for idle
          <mesh rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.03, 0.008, 6, 10, Math.PI]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        )
      })()}
    </group>
  )
}

// Thinking indicators (floating dots above head when active)
// Note: All other Three.js objects in this file are JSX-declared; R3F handles their disposal.
function ThinkingDots({ visible }: { visible: boolean }) {
  const ref = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!ref.current || !visible) return
    const t = clock.getElapsedTime()
    ref.current.children.forEach((dot, i) => {
      dot.position.y = 0.56 + Math.sin(t * 3 + i * 0.8) * 0.03
      // Mutate existing material instead of creating new one each frame (memory leak fix)
      const mat = (dot as THREE.Mesh).material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.3 + Math.sin(t * 2 + i) * 0.2
    })
  })

  if (!visible) return null

  return (
    <group ref={ref}>
      {[-0.06, 0, 0.06].map((x, i) => (
        <mesh key={`x-${i}`} position={[x, 0.56, 0.1]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#818cf8" emissive="#818cf8" emissiveIntensity={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function ExpressiveBot({ config, status }: { config: BotVariantConfig; status: AgentStatus }) {
  const groupRef = useRef<THREE.Group>(null)
  const darkColor = new THREE.Color(config.color).multiplyScalar(0.65)
  const darkHex = '#' + darkColor.getHexString()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    if (status === 'active') {
      groupRef.current.position.y = Math.sin(t * 2) * 0.015
      groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.08
    } else if (status === 'sleeping') {
      const breathe = 1 + Math.sin(t * 0.8) * 0.008
      groupRef.current.scale.set(1, breathe, 1)
      groupRef.current.rotation.z = 0.08
      groupRef.current.rotation.y = 0
    } else {
      groupRef.current.position.y = Math.sin(t * 1.2) * 0.008
      groupRef.current.rotation.y = Math.sin(t * 0.25) * 0.1
      groupRef.current.rotation.z = 0
    }
  })

  let statusRingColor: string
  if (status === 'active') {
    statusRingColor = '#22c55e'
  } else if (status === 'idle') {
    statusRingColor = '#f59e0b'
  } else {
    statusRingColor = '#6366f1'
  }

  return (
    <group ref={groupRef} position={[0, 0.1, 0]} scale={2.4}>
      {/* Head */}
      <group position={[0, 0.32, 0]}>
        <RoundedBox args={[0.36, 0.32, 0.32]} radius={0.07} smoothness={3}>
          <meshToonMaterial color={config.color} />
        </RoundedBox>
        {/* Expressive eyes */}
        <BotEye position={[-0.09, 0.34, 0.175]} status={status} side="left" />
        <BotEye position={[0.09, 0.34, 0.175]} status={status} side="right" />
        {/* Expressive mouth */}
        <BotMouth status={status} />
      </group>

      {/* Thinking dots */}
      <ThinkingDots visible={status === 'active'} />

      {/* Body */}
      <RoundedBox args={[0.4, 0.28, 0.34]} radius={0.06} smoothness={3} position={[0, -0.02, 0]}>
        <meshToonMaterial color={config.color} />
      </RoundedBox>
      {/* Lower body */}
      <RoundedBox args={[0.4, 0.12, 0.34]} radius={0.04} smoothness={3} position={[0, -0.14, 0]}>
        <meshToonMaterial color={darkHex} />
      </RoundedBox>
      {/* Arms */}
      <mesh position={[-0.26, 0, 0]} rotation={[0, 0, 0.2]}>
        <capsuleGeometry args={[0.04, 0.12, 4, 6]} />
        <meshToonMaterial color={config.color} />
      </mesh>
      <mesh position={[0.26, 0, 0]} rotation={[0, 0, -0.2]}>
        <capsuleGeometry args={[0.04, 0.12, 4, 6]} />
        <meshToonMaterial color={config.color} />
      </mesh>

      {/* Status glow ring */}
      <mesh position={[0, -0.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.26, 20]} />
        <meshStandardMaterial
          color={statusRingColor}
          emissive={statusRingColor}
          emissiveIntensity={0.6}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Laptop when active */}
      {status === 'active' && (
        <group position={[0, -0.05, 0.28]} rotation={[-0.3, 0, 0]}>
          <mesh>
            <boxGeometry args={[0.18, 0.008, 0.12]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, 0.06, -0.06]} rotation={[0.8, 0, 0]}>
            <boxGeometry args={[0.16, 0.1, 0.006]} />
            <meshStandardMaterial color="#1e40af" emissive="#1e40af" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}
    </group>
  )
}

// ── Main Scene ─────────────────────────────────────────────────

interface AgentScene3DProps {
  readonly botConfig: BotVariantConfig
  readonly agentStatus: AgentStatus
  readonly mini?: boolean
}

export default function AgentScene3D({ botConfig, agentStatus, mini }: AgentScene3DProps) {
  // Mini mode: closer camera focused on face, no controls
  const cameraPos: [number, number, number] = mini ? [0, 1.1, 2] : [1.5, 2, 2.5]

  return (
    <Canvas
      dpr={[1, mini ? 1.25 : 1.5]}
      camera={{ position: cameraPos, fov: mini ? 35 : 45, near: 0.1, far: 20 }}
      style={{ width: '100%', height: '100%', touchAction: 'none' }}
      frameloop="always"
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} />
      <pointLight position={[-2, 3, -1]} intensity={0.3} color="#6366f1" />

      {/* Minimal floor for mini mode */}
      {!mini && (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[4, 4]} />
            <meshStandardMaterial color="#1a2332" />
          </mesh>
          <gridHelper args={[4, 8, '#1e3a5f', '#152030']} position={[0, 0.001, 0]} />
        </group>
      )}

      <ExpressiveBot config={botConfig} status={agentStatus} />

      {/* No orbit controls in mini mode */}
    </Canvas>
  )
}

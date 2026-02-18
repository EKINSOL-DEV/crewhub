/**
 * ChatHeader3DScene — Minimal Three.js scene for the chat header avatar.
 * Head-only bot preview: camera framed tightly on the head.
 * Idle animations: gentle float/bob + eye blinking.
 * Not interactive — purely decorative.
 */
import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { RoundedBox, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { AgentStatus } from './AgentCameraView'
import type { BotVariantConfig } from '@/components/world3d/utils/botVariants'
import type { AvatarAnimation } from './ChatHeader3DAvatar'

// ── Camera strategy ────────────────────────────────────────────
// Head world centre Y = head.local.y × group.scale = 0.34 × 2.2 = 0.748.
// Head world width  = 0.30 × 2.2 = 0.66  units.
// Head world height = 0.30 × 2.2 = 0.66  units.
// Canvas aspect     = 128 / 72   ≈ 1.778.
//
// We use a group-as-pivot at Y=0.748 (head world centre).
// The PerspectiveCamera sits at local [0, 0, 0.9] inside that group,
// which means its world position = [0, 0.748, 0.9].
// Three.js cameras default look direction is -Z, so the camera looks
// straight toward [0, 0.748, 0] — exactly the head centre. No rotation needed.
//
// Vertical view at Z=0.9, FOV 50: 2 × 0.9 × tan(25°) ≈ 0.84 units.
// Head (0.66 units) + max bob (0.08) = 0.74 — fits comfortably. ✓
const HEAD_WORLD_Y = 0.35
const CAM_Z = 0.65
const DEBUG_CAMERA = false // set true to re-enable tuning overlay

// ── Full-body Bot (head shown by camera framing) ───────────────

interface HeaderBotProps {
  config: BotVariantConfig
  status: AgentStatus
  animation: AvatarAnimation
}

function HeaderBot({ config, status, animation }: HeaderBotProps) {
  const groupRef    = useRef<THREE.Group>(null)
  const leftEyeRef  = useRef<THREE.Group>(null)
  const rightEyeRef = useRef<THREE.Group>(null)

  const darkColor = new THREE.Color(config.color).multiplyScalar(0.65)
  const darkHex   = '#' + darkColor.getHexString()
  const footColor = new THREE.Color(config.color).multiplyScalar(0.5)
  const footHex   = '#' + footColor.getHexString()

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()

    // ── Movement based on animation prop ──
    if (animation === 'thinking') {
      // Faster bob + slight side tilt = "processing" feel
      groupRef.current.position.y = Math.sin(t * 2.5) * 0.04
      groupRef.current.rotation.y = Math.sin(t * 0.8) * 0.10
      groupRef.current.rotation.z = Math.sin(t * 1.5) * 0.02
    } else {
      // idle — gentle float
      groupRef.current.position.y = Math.sin(t * 1.0) * 0.04
      groupRef.current.rotation.y = Math.sin(t * 0.25) * 0.08
      groupRef.current.rotation.z = 0
    }

    // Sleeping override: breathe + tilt
    if (status === 'sleeping') {
      const breathe = 1 + Math.sin(t * 0.8) * 0.006
      groupRef.current.scale.set(1, breathe, 1)
      groupRef.current.rotation.z = 0.06
      groupRef.current.rotation.y = 0
      groupRef.current.position.y = 0
    } else {
      groupRef.current.scale.set(1, 1, 1)
    }

    // ── Eye blink every ~4 s ──
    const blinkPhase = t % 4
    const blinkScale = blinkPhase > 3.80 && blinkPhase < 3.95 ? 0.05 : 1.0
    if (leftEyeRef.current)  leftEyeRef.current.scale.y  = blinkScale
    if (rightEyeRef.current) rightEyeRef.current.scale.y = blinkScale
  })

  const glowColor =
    status === 'active'   ? '#22c55e' :
    status === 'idle'     ? '#f59e0b' :
                            '#6366f1'

  return (
    <group ref={groupRef} position={[0, 0, 0]} scale={2.2}>

      {/* ── Head ── */}
      <group position={[0, 0.34, 0]}>
        <RoundedBox args={[0.34, 0.30, 0.30]} radius={0.07} smoothness={3}>
          <meshToonMaterial color={config.color} />
        </RoundedBox>

        {/* Left eye — grouped for blink scale */}
        <group ref={leftEyeRef} position={[-0.08, 0.01, 0]}>
          <mesh position={[0, 0, 0.155]}>
            <circleGeometry args={[0.055, 14]} />
            <meshStandardMaterial color="white" />
          </mesh>
          <mesh position={[0, 0, 0.162]}>
            <circleGeometry args={[0.028, 10]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>

        {/* Right eye — grouped for blink scale */}
        <group ref={rightEyeRef} position={[0.08, 0.01, 0]}>
          <mesh position={[0, 0, 0.155]}>
            <circleGeometry args={[0.055, 14]} />
            <meshStandardMaterial color="white" />
          </mesh>
          <mesh position={[0, 0, 0.162]}>
            <circleGeometry args={[0.028, 10]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>

        {/* Mouth — tiny smile */}
        <mesh position={[0, -0.045, 0.16]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.026, 0.007, 6, 10, Math.PI]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>

      {/* ── Body ── */}
      <RoundedBox
        args={[0.38, 0.26, 0.30]}
        radius={0.06}
        smoothness={3}
        position={[0, 0.0, 0]}
      >
        <meshToonMaterial color={config.color} />
      </RoundedBox>

      {/* ── Waist / Lower body ── */}
      <RoundedBox
        args={[0.34, 0.10, 0.28]}
        radius={0.04}
        smoothness={3}
        position={[0, -0.16, 0]}
      >
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
      <RoundedBox
        args={[0.12, 0.07, 0.16]}
        radius={0.03}
        smoothness={2}
        position={[-0.10, -0.40, 0.03]}
      >
        <meshToonMaterial color={footHex} />
      </RoundedBox>
      <RoundedBox
        args={[0.12, 0.07, 0.16]}
        radius={0.03}
        smoothness={2}
        position={[0.10, -0.40, 0.03]}
      >
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
  /** Animation mode — drives movement behaviour */
  animation?: AvatarAnimation
}

export default function ChatHeader3DScene({
  botConfig,
  agentStatus,
  animation = 'idle',
}: ChatHeader3DSceneProps) {
  // Production path — no debug state allocated
  if (!DEBUG_CAMERA) {
    return (
      <Canvas dpr={[1, 1.5]} style={{ width: '100%', height: '100%', touchAction: 'none' }}
        frameloop="always" gl={{ antialias: true, powerPreference: 'low-power', alpha: true }}>
        <group position={[0, HEAD_WORLD_Y, 0]}>
          <PerspectiveCamera makeDefault position={[0, 0, CAM_Z]} fov={50} near={0.1} far={20} />
        </group>
        <color attach="background" args={['#0d1626']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={0.85} />
        <pointLight position={[-2, 2, 1]} intensity={0.3} color="#6366f1" />
        <HeaderBot config={botConfig} status={agentStatus} animation={animation} />
      </Canvas>
    )
  }

  // Unreachable when DEBUG_CAMERA=false, but kept for future tuning sessions.
  return <ChatHeader3DSceneDebug botConfig={botConfig} agentStatus={agentStatus} animation={animation} />
}

/** Debug-only component — only rendered when DEBUG_CAMERA=true. Separated to avoid hook rules violation. */
function ChatHeader3DSceneDebug({ botConfig, agentStatus, animation }: {
  botConfig: BotVariantConfig; agentStatus: AgentStatus; animation: AvatarAnimation
}) {
  const [pivotY, setPivotY] = useState(HEAD_WORLD_Y)
  const [camZ, setCamZ] = useState(CAM_Z)
  const step = 0.05

  const btn = (label: string, onClick: () => void) => (
    <button onClick={onClick} style={{
      background: '#334155', color: '#e2e8f0', border: 'none', borderRadius: 4,
      padding: '2px 6px', fontSize: 11, cursor: 'pointer', touchAction: 'manipulation',
    }}>{label}</button>
  )

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <Canvas dpr={[1, 1.5]} style={{ width: '100%', height: 150, touchAction: 'none' }}
        frameloop="always" gl={{ antialias: true, powerPreference: 'low-power', alpha: true }}>
        <group position={[0, pivotY, 0]}>
          <PerspectiveCamera makeDefault position={[0, 0, camZ]} fov={50} near={0.1} far={20} />
        </group>
        <axesHelper args={[0.5]} />
        <color attach="background" args={['#0d1626']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[2, 4, 3]} intensity={0.85} />
        <pointLight position={[-2, 2, 1]} intensity={0.3} color="#6366f1" />
        <HeaderBot config={botConfig} status={agentStatus} animation={animation} />
      </Canvas>
      <div style={{ background: '#0f172a', padding: '4px 8px', fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
          <span style={{ color: '#a6e3a1', minWidth: 60 }}>Y: {pivotY.toFixed(2)}</span>
          {btn('▲', () => setPivotY(v => +(v + step).toFixed(2)))}
          {btn('▼', () => setPivotY(v => +(v - step).toFixed(2)))}
          <span style={{ color: '#89b4fa', minWidth: 60, marginLeft: 8 }}>Z: {camZ.toFixed(2)}</span>
          {btn('+', () => setCamZ(v => +(v + step).toFixed(2)))}
          {btn('−', () => setCamZ(v => +(v - step).toFixed(2)))}
        </div>
        <div style={{ color: '#64748b', fontSize: 10 }}>HEAD_WORLD_Y={pivotY.toFixed(2)} camZ={camZ.toFixed(2)}</div>
      </div>
    </div>
  )
}

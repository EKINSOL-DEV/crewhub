import { useState, useRef, useMemo, Suspense, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, RoundedBox, Float, Sparkles, Html } from '@react-three/drei'
import * as THREE from 'three'

// ─── Types ───────────────────────────────────────────────────────────
type BotState = 'active' | 'idle' | 'sleeping' | 'working' | 'error'
type BubbleStyle = 'speech' | 'thought' | 'alert'
type CameraPreset = 'front' | 'isometric' | 'top-down'

interface BotConfig {
  id: string
  name: string
  color: string
  icon: string
  accessory: 'hardhat' | 'antenna' | 'clock' | 'chat' | 'gear'
}

interface BotUiState {
  state: BotState
  bubbleText: string
  bubbleStyle: BubbleStyle
  showBubble: boolean
}

// ─── Constants ───────────────────────────────────────────────────────
const BOTS: BotConfig[] = [
  { id: 'worker', name: 'Worker Bot', color: '#FE9600', icon: '🔧', accessory: 'hardhat' },
  { id: 'thinker', name: 'Thinker Bot', color: '#1277C3', icon: '💡', accessory: 'antenna' },
  { id: 'cron', name: 'Cron Bot', color: '#82B30E', icon: '⏰', accessory: 'clock' },
  { id: 'comms', name: 'Comms Bot', color: '#9370DB', icon: '💬', accessory: 'chat' },
  { id: 'dev', name: 'Dev Bot', color: '#F32A1C', icon: '⚙️', accessory: 'gear' },
]

const STATE_GLOW: Record<BotState, string> = {
  active: '#4ade80',
  idle: '#fbbf24',
  sleeping: '#9ca3af',
  working: '#4ade80',
  error: '#ef4444',
}

const STATE_LABELS: BotState[] = ['active', 'idle', 'sleeping', 'working', 'error']
const BUBBLE_STYLES: BubbleStyle[] = ['speech', 'thought', 'alert']

// ─── 3D helpers ──────────────────────────────────────────────────────

/** Blinking eyes that close during sleeping state */
function BotEyes({ state, color: _color }: { state: BotState; color: string }) {
  const leftRef = useRef<THREE.Mesh>(null)
  const rightRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Blink every ~3s
    const blink = Math.sin(t * 2.1) > 0.97
    const closed = state === 'sleeping' || blink
    const sy = closed ? 0.05 : 1
    leftRef.current?.scale.set(1, sy, 1)
    rightRef.current?.scale.set(1, sy, 1)
  })

  return (
    <group position={[0, 0.32, 0.19]}>
      {/* Left eye */}
      <mesh ref={leftRef} position={[-0.07, 0, 0]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-0.07, 0, 0.03]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Right eye */}
      <mesh ref={rightRef} position={[0.07, 0, 0]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0.07, 0, 0.03]}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshStandardMaterial color="#222" />
      </mesh>
    </group>
  )
}

/** Cute little smile / expression */
function BotMouth({ state }: { state: BotState }) {
  const color = state === 'error' ? '#ef4444' : '#333'
  // Simple arc using a torus segment
  return (
    <group position={[0, 0.22, 0.2]} rotation={[0.2, 0, 0]}>
      <mesh>
        <torusGeometry args={[0.04, 0.008, 8, 16, state === 'error' ? Math.PI : Math.PI]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

/** Hard hat accessory (Worker) */
function HardHat({ color }: { color: string }) {
  return (
    <group position={[0, 0.48, 0]}>
      {/* Dome */}
      <mesh>
        <sphereGeometry args={[0.18, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.2} />
      </mesh>
      {/* Brim */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.24, 24]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/** Antenna accessory (Thinker) */
function Antenna({ color }: { color: string }) {
  const bulbRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (bulbRef.current) {
      const mat = bulbRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.5 + Math.sin(clock.getElapsedTime() * 3) * 0.4
    }
  })
  return (
    <group position={[0, 0.52, 0]}>
      <mesh>
        <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
        <meshStandardMaterial color="#aaa" metalness={0.5} />
      </mesh>
      <mesh ref={bulbRef} position={[0, 0.14, 0]}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshStandardMaterial color="#ffeb3b" emissive={color} emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

/** Clock face accessory (Cron) */
function ClockFace({ color }: { color: string }) {
  const handRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (handRef.current) {
      handRef.current.rotation.z = -clock.getElapsedTime() * 1.5
    }
  })
  return (
    <group position={[0, 0.5, 0.05]}>
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 24]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Face ring */}
      <mesh position={[0, 0, 0.021]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.11, 0.01, 8, 24]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Hour hand */}
      <mesh ref={handRef} position={[0, 0, 0.025]}>
        <boxGeometry args={[0.01, 0.07, 0.005]} />
        <meshStandardMaterial color="#333" />
      </mesh>
    </group>
  )
}

/** Chat icon accessory (Comms) */
function ChatIcon({ color }: { color: string }) {
  return (
    <group position={[0, 0.52, 0]}>
      <Float speed={3} floatIntensity={0.15} rotationIntensity={0}>
        <RoundedBox args={[0.16, 0.12, 0.04]} radius={0.02}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
        </RoundedBox>
        {/* Little dots inside */}
        {[-0.035, 0, 0.035].map((x, i) => (
          <mesh key={`x-${i}`} position={[x, 0, 0.025]}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshStandardMaterial color="white" />
          </mesh>
        ))}
      </Float>
    </group>
  )
}

/** Gear accessory (Dev) */
function GearIcon({ color }: { color: string }) {
  const gearRef = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (gearRef.current) gearRef.current.rotation.z = clock.getElapsedTime() * 0.8
  })
  return (
    <group position={[0, 0.52, 0.05]}>
      <group ref={gearRef}>
        <mesh>
          <torusGeometry args={[0.07, 0.02, 8, 6]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.04, 16]} />
          <meshStandardMaterial color={color} metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function BotAccessory({ type, color }: { type: BotConfig['accessory']; color: string }) {
  switch (type) {
    case 'hardhat':
      return <HardHat color={color} />
    case 'antenna':
      return <Antenna color={color} />
    case 'clock':
      return <ClockFace color={color} />
    case 'chat':
      return <ChatIcon color={color} />
    case 'gear':
      return <GearIcon color={color} />
  }
}

/** Floating Z particles for sleeping state */
function SleepingZs() {
  const zRefs = useRef<THREE.Group[]>([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    zRefs.current.forEach((ref, i) => {
      if (ref) {
        const phase = (t * 0.6 + i * 1.2) % 3
        ref.position.y = 0.7 + phase * 0.3
        ref.position.x = Math.sin(t + i) * 0.15
        const opacity = phase < 2.5 ? 1 : 1 - (phase - 2.5) * 2
        ref.scale.setScalar(0.6 + phase * 0.15)
        ref.children.forEach((child) => {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial
          if (mat.opacity !== undefined) mat.opacity = Math.max(0, opacity)
        })
      }
    })
  })

  return (
    <group>
      {[0, 1, 2].map((i) => (
        <group
          key={`item-${i}`}
          ref={(el) => {
            if (el) zRefs.current[i] = el
          }}
        >
          <Text
            fontSize={0.12}
            color="#9ca3af"
            anchorX="center"
            anchorY="middle"
            material-transparent
            material-opacity={1}
          >
            Z
          </Text>
        </group>
      ))}
    </group>
  )
}

/** Error exclamation mark */
function ErrorMark() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = 0.85 + Math.sin(clock.getElapsedTime() * 6) * 0.03
    }
  })
  return (
    <group ref={ref} position={[0, 0.85, 0]}>
      <Text fontSize={0.2} color="#ef4444" anchorX="center" anchorY="middle">
        ❗
      </Text>
    </group>
  )
}

/** 3D chat bubble */
function ChatBubble3D({
  text,
  style,
  visible,
}: {
  readonly text: string
  readonly style: BubbleStyle
  readonly visible: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const scaleRef = useRef(0)

  useFrame((_, delta) => {
    const target = visible ? 1 : 0
    scaleRef.current = THREE.MathUtils.lerp(scaleRef.current, target, delta * 8)
    if (groupRef.current) {
      groupRef.current.scale.setScalar(scaleRef.current)
      groupRef.current.position.y = 0.9 + Math.sin(Date.now() * 0.002) * 0.03
    }
  })

  if (scaleRef.current < 0.01 && !visible) return null

  const displayText = style === 'alert' ? '❗' : text || '...'
  const bgColor = style === 'alert' ? '#fef2f2' : '#ffffff'
  let borderColor: string
  if (style === 'alert') {
    borderColor = '#ef4444'
  } else if (style === 'thought') {
    borderColor = '#a5b4fc'
  } else {
    borderColor = '#d1d5db'
  }

  return (
    <group ref={groupRef} position={[0, 0.9, 0]}>
      <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: bgColor,
            border: `2px solid ${borderColor}`,
            borderRadius: style === 'thought' ? '20px' : '12px',
            padding: '6px 12px',
            maxWidth: '140px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#333',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            position: 'relative',
          }}
        >
          {displayText}
          {style === 'thought' && (
            <div
              style={{
                position: 'absolute',
                bottom: -10,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: 3,
                alignItems: 'flex-end',
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: borderColor }} />
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: borderColor }} />
            </div>
          )}
          {style === 'speech' && (
            <div
              style={{
                position: 'absolute',
                bottom: -8,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: `8px solid ${borderColor}`,
              }}
            />
          )}
        </div>
      </Html>
    </group>
  )
}

/** Single 3D Bot character */
function Bot3DCharacter({
  config,
  uiState,
  position,
}: {
  readonly config: BotConfig
  readonly uiState: BotUiState
  readonly position: [number, number, number]
}) {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const leftArmRef = useRef<THREE.Mesh>(null)
  const rightArmRef = useRef<THREE.Mesh>(null)
  const bodyRef = useRef<THREE.Mesh>(null)

  const glowColor = STATE_GLOW[uiState.state]

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!groupRef.current) return

    // Reset
    groupRef.current.rotation.z = 0
    groupRef.current.position.y = position[1]

    switch (uiState.state) {
      case 'active':
        // Walking / bouncing
        groupRef.current.position.y = position[1] + Math.abs(Math.sin(t * 6)) * 0.12
        groupRef.current.rotation.z = Math.sin(t * 6) * 0.06
        break
      case 'idle':
        // Gentle hover + look around
        groupRef.current.position.y = position[1] + Math.sin(t * 1.5) * 0.03
        groupRef.current.rotation.y = Math.sin(t * 0.5) * 0.3
        break
      case 'sleeping':
        // Slow pulse
        {
          const scale = 1 + Math.sin(t * 1.2) * 0.02
          groupRef.current.scale.set(scale, scale, scale)
        }
        break
      case 'working':
        // Typing hands animation
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.rotation.x = Math.sin(t * 12) * 0.4
          rightArmRef.current.rotation.x = Math.sin(t * 12 + Math.PI) * 0.4
        }
        break
      case 'error':
        // Shake / vibrate
        groupRef.current.position.x = position[0] + Math.sin(t * 30) * 0.03
        if (bodyRef.current) {
          const mat = bodyRef.current.material as THREE.MeshStandardMaterial
          mat.emissiveIntensity = Math.sin(t * 8) > 0 ? 0.5 : 0
        }
        break
    }

    // Glow pulse
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = 0.4 + Math.sin(t * 3) * 0.3
    }
  })

  const showSparkles = uiState.state === 'active' || uiState.state === 'working'

  return (
    <group ref={groupRef} position={position}>
      {/* Status glow ring */}
      <mesh ref={glowRef} position={[0, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.32, 32]} />
        <meshStandardMaterial
          color={glowColor}
          emissive={glowColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Body - capsule */}
      <mesh ref={bodyRef} position={[0, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.35, 16, 16]} />
        <meshStandardMaterial
          color={config.color}
          roughness={0.3}
          metalness={0.1}
          emissive={uiState.state === 'error' ? '#ef4444' : '#000000'}
          emissiveIntensity={0}
        />
      </mesh>

      {/* Eyes */}
      <BotEyes state={uiState.state} color={config.color} />

      {/* Mouth */}
      <BotMouth state={uiState.state} />

      {/* Accessory */}
      <BotAccessory type={config.accessory} color={config.color} />

      {/* Left arm */}
      <mesh ref={leftArmRef} position={[-0.24, 0.05, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.15, 8, 8]} />
        <meshStandardMaterial color={config.color} roughness={0.4} />
      </mesh>

      {/* Right arm */}
      <mesh ref={rightArmRef} position={[0.24, 0.05, 0]} castShadow>
        <capsuleGeometry args={[0.04, 0.15, 8, 8]} />
        <meshStandardMaterial color={config.color} roughness={0.4} />
      </mesh>

      {/* Left foot */}
      <mesh position={[-0.08, -0.32, 0.04]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.12]} />
        <meshStandardMaterial color="#333" roughness={0.7} />
      </mesh>

      {/* Right foot */}
      <mesh position={[0.08, -0.32, 0.04]} castShadow>
        <boxGeometry args={[0.08, 0.06, 0.12]} />
        <meshStandardMaterial color="#333" roughness={0.7} />
      </mesh>

      {/* Sparkles */}
      {showSparkles && <Sparkles count={30} scale={1} size={4} speed={0.6} color={glowColor} />}

      {/* Sleeping Zs */}
      {uiState.state === 'sleeping' && <SleepingZs />}

      {/* Error mark */}
      {uiState.state === 'error' && <ErrorMark />}

      {/* Chat bubble */}
      <ChatBubble3D
        text={uiState.bubbleText}
        style={uiState.bubbleStyle}
        visible={uiState.showBubble}
      />

      {/* Name label */}
      <Text
        position={[0, -0.48, 0]}
        fontSize={0.08}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.005}
        outlineColor="#000"
      >
        {config.name}
      </Text>
    </group>
  )
}

/** Ground plane */
function Ground({ showGrid }: { showGrid: boolean }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
      </mesh>
      {showGrid && (
        <>
          <gridHelper args={[20, 20, '#2a2a4e', '#1f1f3a']} position={[0, -0.49, 0]} />
          <gridHelper args={[20, 4, '#4f46e5', '#4f46e520']} position={[0, -0.48, 0]} />
        </>
      )}
    </group>
  )
}

/** The full 3D scene */
function BotScene({
  botStates,
  showShadows,
  showGrid,
  showSparkles: _showSparkles,
}: {
  readonly botStates: Record<string, BotUiState>
  readonly showShadows: boolean
  readonly showGrid: boolean
  readonly showSparkles: boolean
}) {
  const spacing = 2
  const startX = -((BOTS.length - 1) * spacing) / 2

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[8, 15, 8]}
        intensity={1.2}
        castShadow={showShadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={30}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-6, 8, -6]} intensity={0.4} color="#4f46e5" />
      <pointLight position={[6, 6, 6]} intensity={0.3} color="#f97316" />

      {/* Ground */}
      <Ground showGrid={showGrid} />

      {/* Bots */}
      {BOTS.map((bot, i) => (
        <Bot3DCharacter
          key={bot.id}
          config={bot}
          uiState={
            botStates[bot.id] || {
              state: 'idle',
              bubbleText: '',
              bubbleStyle: 'speech',
              showBubble: false,
            }
          }
          position={[startX + i * spacing, 0, 0]}
        />
      ))}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={3}
        maxDistance={20}
      />
    </>
  )
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color="#4f46e5" wireframe />
    </mesh>
  )
}

// ─── Camera preset positions ─────────────────────────────────────────
const CAMERA_POSITIONS: Record<CameraPreset, [number, number, number]> = {
  front: [0, 1.5, 8],
  isometric: [6, 5, 6],
  'top-down': [0, 10, 0.1],
}

// ─── Main exported component ─────────────────────────────────────────
export function DesignLab3D({ darkBg }: { darkBg: boolean }) {
  // Per-bot UI state
  const [botStates, setBotStates] = useState<Record<string, BotUiState>>(() => {
    const initial: Record<string, BotUiState> = {}
    BOTS.forEach((bot) => {
      initial[bot.id] = { state: 'idle', bubbleText: '', bubbleStyle: 'speech', showBubble: false }
    })
    return initial
  })

  // Global settings
  const [showShadows, setShowShadows] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [showSparkles, setShowSparkles] = useState(true)
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('isometric')
  const [expandedBot, setExpandedBot] = useState<string | null>(null)

  // Memoised camera position
  const cameraPos = useMemo(() => CAMERA_POSITIONS[cameraPreset], [cameraPreset])

  const updateBot = useCallback((id: string, patch: Partial<BotUiState>) => {
    setBotStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }, [])

  const setAllStates = useCallback((state: BotState) => {
    setBotStates((prev) => {
      const next = { ...prev }
      BOTS.forEach((b) => {
        next[b.id] = { ...next[b.id], state }
      })
      return next
    })
  }, [])

  const cardBg = darkBg ? 'bg-gray-800' : 'bg-white shadow-sm'
  const textPrimary = darkBg ? 'text-white' : 'text-gray-900'
  const textSecondary = darkBg ? 'text-gray-400' : 'text-gray-600'
  const inputBg = darkBg
    ? 'bg-gray-700 text-white border-gray-600'
    : 'bg-gray-50 text-gray-900 border-gray-300'
  const btnBase = darkBg
    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  const btnActive = 'bg-blue-500 text-white'

  return (
    <div className="mt-12 space-y-6">
      {/* Section Header */}
      <div className={`rounded-2xl p-6 ${cardBg}`}>
        <h2 className={`text-2xl font-bold mb-2 ${textPrimary}`}>
          🎮 3D Bot Playground <span className="text-sm font-normal text-blue-400">(POC)</span>
        </h2>
        <p className={textSecondary}>
          Interactive 3D characters with animations, states, and chat bubbles. Built with Three.js
          primitives.
        </p>
      </div>

      {/* Global Controls */}
      <div className={`rounded-2xl p-5 space-y-4 ${cardBg}`}>
        <h3 className={`font-semibold ${textPrimary}`}>🎛️ Global Controls</h3>

        <div className="flex flex-wrap gap-4">
          {/* Camera Presets */}
          <div className="space-y-1">
            <span className={`text-xs font-medium ${textSecondary}`}>Camera</span>
            <div className="flex gap-1">
              {(['front', 'isometric', 'top-down'] as CameraPreset[]).map((p) => {
                let cameraIcon: string
                if (p === 'front') {
                  cameraIcon = '📷'
                } else if (p === 'isometric') {
                  cameraIcon = '🔲'
                } else {
                  cameraIcon = '🔽'
                }
                return (
                  <button
                    key={p}
                    onClick={() => setCameraPreset(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      cameraPreset === p ? btnActive : btnBase
                    }`}
                  >
                    {cameraIcon} {p}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-1">
            <span className={`text-xs font-medium ${textSecondary}`}>Scene</span>
            <div className="flex gap-1">
              {[
                {
                  label: '💡 Shadows',
                  value: showShadows,
                  toggle: () => setShowShadows((v) => !v),
                },
                { label: '📏 Grid', value: showGrid, toggle: () => setShowGrid((v) => !v) },
                {
                  label: '✨ Sparkles',
                  value: showSparkles,
                  toggle: () => setShowSparkles((v) => !v),
                },
              ].map((t) => (
                <button
                  key={t.label}
                  onClick={t.toggle}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    t.value ? btnActive : btnBase
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Set All States */}
          <div className="space-y-1">
            <span className={`text-xs font-medium ${textSecondary}`}>All Bots →</span>
            <div className="flex gap-1">
              {STATE_LABELS.map((s) => (
                <button
                  key={s}
                  onClick={() => setAllStates(s)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${btnBase} capitalize`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Per-Bot Controls */}
      <div className={`rounded-2xl p-5 space-y-3 ${cardBg}`}>
        <h3 className={`font-semibold ${textPrimary}`}>🤖 Bot Controls</h3>
        <div className="space-y-2">
          {BOTS.map((bot) => {
            const st = botStates[bot.id]
            const isExpanded = expandedBot === bot.id
            return (
              <div
                key={bot.id}
                className={`rounded-xl p-3 transition-all ${
                  darkBg ? 'bg-gray-700/50' : 'bg-gray-50'
                }`}
              >
                {/* Bot header row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setExpandedBot(isExpanded ? null : bot.id)}
                    className="flex items-center gap-2 min-w-0"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: bot.color }}
                    />
                    <span className={`font-medium text-sm ${textPrimary}`}>
                      {bot.icon} {bot.name}
                    </span>
                    <span className={`text-xs ${textSecondary}`}>{isExpanded ? '▼' : '▶'}</span>
                  </button>

                  {/* State buttons - always visible */}
                  <div className="flex gap-1 ml-auto">
                    {STATE_LABELS.map((s) => (
                      <button
                        key={s}
                        onClick={() => updateBot(bot.id, { state: s })}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-all capitalize ${
                          st.state === s ? btnActive : btnBase
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expanded: bubble controls */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-600/30 flex flex-wrap items-center gap-3">
                    {/* Bubble toggle */}
                    <button
                      onClick={() => updateBot(bot.id, { showBubble: !st.showBubble })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        st.showBubble ? btnActive : btnBase
                      }`}
                    >
                      💬 Bubble {st.showBubble ? 'ON' : 'OFF'}
                    </button>

                    {/* Bubble style */}
                    <div className="flex gap-1">
                      {BUBBLE_STYLES.map((bs) => {
                        let bubbleIcon: string
                        if (bs === 'speech') {
                          bubbleIcon = '💬'
                        } else if (bs === 'thought') {
                          bubbleIcon = '💭'
                        } else {
                          bubbleIcon = '❗'
                        }
                        return (
                          <button
                            key={bs}
                            onClick={() => updateBot(bot.id, { bubbleStyle: bs })}
                            className={`px-2 py-1 rounded text-[10px] font-medium capitalize transition-all ${
                              st.bubbleStyle === bs ? btnActive : btnBase
                            }`}
                          >
                            {bubbleIcon} {bs}
                          </button>
                        )
                      })}
                    </div>

                    {/* Bubble text */}
                    <input
                      type="text"
                      placeholder="Bubble text..."
                      value={st.bubbleText}
                      onChange={(e) => updateBot(bot.id, { bubbleText: e.target.value })}
                      className={`flex-1 min-w-[140px] px-3 py-1.5 rounded-lg text-xs border ${inputBg}`}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 3D Canvas */}
      <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
        <div style={{ height: 500 }}>
          <Canvas
            shadows={showShadows}
            camera={{ position: cameraPos, fov: 50, near: 0.1, far: 100 }}
            style={{
              background: 'linear-gradient(180deg, #0f0f23 0%, #1a1a2e 100%)',
              borderRadius: '1rem',
            }}
          >
            <Suspense fallback={<LoadingFallback />}>
              <BotScene
                botStates={botStates}
                showShadows={showShadows}
                showGrid={showGrid}
                showSparkles={showSparkles}
              />
            </Suspense>
          </Canvas>
        </div>

        {/* Canvas info bar */}
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between border-t ${
            darkBg ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'
          }`}
        >
          <span>🖱️ Drag: Rotate · Scroll: Zoom · Right-drag: Pan</span>
          <span>Three.js r{THREE.REVISION} · @react-three/fiber + drei</span>
        </div>
      </div>
    </div>
  )
}

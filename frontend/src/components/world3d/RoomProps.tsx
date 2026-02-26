import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Desk } from './props/Desk'
import { Monitor } from './props/Monitor'
import { Chair } from './props/Chair'
import { Lamp } from './props/Lamp'
import { Plant } from './props/Plant'
import { CoffeeMachine } from './props/CoffeeMachine'
import { WaterCooler } from './props/WaterCooler'
import { NoticeBoard } from './props/NoticeBoard'
import { getToonMaterialProps, WARM_COLORS } from './utils/toonMaterials'

// ─── Room Type Detection ────────────────────────────────────────

function getRoomType(roomName: string): string {
  const name = roomName.toLowerCase()
  if (name.includes('headquarter')) return 'headquarters'
  if (name.includes('dev')) return 'dev'
  if (name.includes('creative') || name.includes('design')) return 'creative'
  if (name.includes('marketing')) return 'marketing'
  if (name.includes('thinking') || name.includes('strategy')) return 'thinking'
  if (name.includes('automation') || name.includes('cron')) return 'automation'
  if (name.includes('comms') || name.includes('comm')) return 'comms'
  if (name.includes('ops') || name.includes('operation')) return 'ops'
  return 'default'
}

// ─── Main Component ─────────────────────────────────────────────

interface RoomPropsProps {
  readonly roomName: string
  readonly roomSize: number
}

export function RoomProps({ roomName, roomSize }: Readonly<RoomPropsProps>) {
  const roomType = getRoomType(roomName)
  const s = roomSize / 12 // scale factor relative to default size 12

  switch (roomType) {
    case 'headquarters':
      return <HeadquartersProps s={s} size={roomSize} />
    case 'dev':
      return <DevRoomProps s={s} size={roomSize} />
    case 'creative':
      return <CreativeRoomProps s={s} size={roomSize} />
    case 'marketing':
      return <MarketingRoomProps s={s} size={roomSize} />
    case 'thinking':
      return <ThinkingRoomProps s={s} size={roomSize} />
    case 'automation':
      return <AutomationRoomProps s={s} size={roomSize} />
    case 'comms':
      return <CommsRoomProps s={s} size={roomSize} />
    case 'ops':
      return <OpsRoomProps s={s} size={roomSize} />
    default:
      return <DefaultRoomProps s={s} size={roomSize} />
  }
}

// ─── Shared Mini-Props ──────────────────────────────────────────

/** Simple whiteboard on a wall */
function Whiteboard({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const frameToon = getToonMaterialProps('#888888')
  const boardToon = getToonMaterialProps('#F5F5F5')
  const trayToon = getToonMaterialProps('#666666')

  return (
    <group position={position} rotation={rotation}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[1.6, 1, 0.05]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      {/* White surface */}
      <mesh position={[0, 0, 0.026]}>
        <boxGeometry args={[1.45, 0.85, 0.005]} />
        <meshToonMaterial {...boardToon} />
      </mesh>
      {/* Marker tray */}
      <mesh position={[0, -0.52, 0.04]}>
        <boxGeometry args={[0.8, 0.04, 0.06]} />
        <meshToonMaterial {...trayToon} />
      </mesh>
    </group>
  )
}

/** Server rack (tall box with blinking light indicators) */
function ServerRack({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const bodyToon = getToonMaterialProps('#2A2A2A')
  const rackToon = getToonMaterialProps('#1A1A1A')

  return (
    <group position={position} rotation={rotation}>
      {/* Main body */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.6, 1.8, 0.5]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      {/* Front panel */}
      <mesh position={[0, 0.9, 0.251]}>
        <boxGeometry args={[0.5, 1.6, 0.01]} />
        <meshToonMaterial {...rackToon} />
      </mesh>
      {/* Rack slots (horizontal lines) */}
      {[0.3, 0.6, 0.9, 1.2, 1.5].map((y, i) => (
        <mesh key={`y-${i}`} position={[0, y, 0.26]}>
          <boxGeometry args={[0.44, 0.08, 0.01]} />
          <meshToonMaterial {...getToonMaterialProps('#333333')} />
        </mesh>
      ))}
      {/* Status LEDs */}
      <ServerLED position={[0.18, 0.35, 0.27]} color="#00FF44" />
      <ServerLED position={[0.18, 0.65, 0.27]} color="#00FF44" />
      <ServerLED position={[0.18, 0.95, 0.27]} color="#FFAA00" />
      <ServerLED position={[0.18, 1.25, 0.27]} color="#00FF44" />
      <ServerLED position={[0.18, 1.55, 0.27]} color="#00FF44" />
    </group>
  )
}

/** Blinking LED for server rack */
function ServerLED({ position, color }: { position: [number, number, number]; readonly color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  // Pre-compute stable blink speed to avoid Math.random() in useFrame
  const blinkSpeed = useMemo(() => 2 + Math.random() * 0.5, [])
  const frameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (!ref.current) return
    // Throttle: update every 3rd frame
    if (++frameSkip.current % 3 !== 0) return
    const mat = ref.current.material as THREE.MeshStandardMaterial
    const blink = Math.sin(clock.getElapsedTime() * blinkSpeed + position[1] * 10) > 0
    mat.emissiveIntensity = blink ? 0.8 : 0.1
  })

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.02, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  )
}

/** Desk lamp (smaller, sits on desk) */
function DeskLamp({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const baseToon = getToonMaterialProps('#444444')
  const armToon = getToonMaterialProps('#555555')
  const shadeToon = getToonMaterialProps('#888888')

  return (
    <group position={position} rotation={rotation}>
      {/* Base */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.04, 10]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      {/* Arm */}
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 6]} />
        <meshToonMaterial {...armToon} />
      </mesh>
      {/* Shade (cone) */}
      <mesh position={[0.06, 0.38, 0]} rotation={[0, 0, 0.2]} castShadow>
        <coneGeometry args={[0.08, 0.1, 8, 1, true]} />
        <meshToonMaterial {...shadeToon} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0.06, 0.35, 0]} intensity={0.2} color="#FFE4B5" distance={3} />
    </group>
  )
}

/** Cable mess on floor */
function CableMess({ position }: { position: [number, number, number] }) {
  const cableToon = getToonMaterialProps('#222222')
  const cableRedToon = getToonMaterialProps('#993333')
  const cableBlueToon = getToonMaterialProps('#334499')

  const cables = [
    {
      pos: [0, 0.01, 0] as [number, number, number],
      rot: [Math.PI / 2, 0, 0.3] as [number, number, number],
      toon: cableToon,
      len: 0.8,
    },
    {
      pos: [0.15, 0.01, 0.1] as [number, number, number],
      rot: [Math.PI / 2, 0, -0.5] as [number, number, number],
      toon: cableRedToon,
      len: 0.6,
    },
    {
      pos: [-0.1, 0.01, -0.05] as [number, number, number],
      rot: [Math.PI / 2, 0, 1.2] as [number, number, number],
      toon: cableBlueToon,
      len: 0.5,
    },
    {
      pos: [0.05, 0.015, 0.15] as [number, number, number],
      rot: [Math.PI / 2, 0, -0.1] as [number, number, number],
      toon: cableToon,
      len: 0.7,
    },
  ]

  return (
    <group position={position}>
      {cables.map((c, i) => (
        <mesh key={`c-${i}`} position={c.pos} rotation={c.rot}>
          <cylinderGeometry args={[0.012, 0.012, c.len, 6]} />
          <meshToonMaterial {...c.toon} />
        </mesh>
      ))}
    </group>
  )
}

/** Easel with canvas */
function Easel({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const woodToon = getToonMaterialProps(WARM_COLORS.wood)
  const canvasToon = getToonMaterialProps('#FFFFF0')

  return (
    <group position={position} rotation={rotation}>
      {/* A-frame legs */}
      <mesh position={[-0.2, 0.6, 0]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[0.04, 1.2, 0.04]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      <mesh position={[0.2, 0.6, 0]} rotation={[0, 0, -0.1]} castShadow>
        <boxGeometry args={[0.04, 1.2, 0.04]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      {/* Back leg */}
      <mesh position={[0, 0.5, -0.2]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 1, 0.04]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      {/* Cross bar */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      {/* Canvas shelf */}
      <mesh position={[0, 0.5, 0.02]} castShadow>
        <boxGeometry args={[0.5, 0.03, 0.06]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      {/* Canvas */}
      <mesh position={[0, 0.85, 0.04]} castShadow>
        <boxGeometry args={[0.7, 0.55, 0.03]} />
        <meshToonMaterial {...canvasToon} />
      </mesh>
      {/* Splash of paint on canvas */}
      <mesh position={[-0.1, 0.9, 0.06]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshToonMaterial {...getToonMaterialProps('#FF6B6B')} />
      </mesh>
      <mesh position={[0.12, 0.8, 0.06]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshToonMaterial {...getToonMaterialProps('#4ECDC4')} />
      </mesh>
      <mesh position={[0, 0.75, 0.06]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshToonMaterial {...getToonMaterialProps('#FFE66D')} />
      </mesh>
    </group>
  )
}

/** Color palette (flat disc with colored dots) */
function ColorPalette({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const baseToon = getToonMaterialProps(WARM_COLORS.woodLight)
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#34D399', '#F97316', '#FFFFFF']

  return (
    <group position={position} rotation={rotation}>
      {/* Palette base */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <circleGeometry args={[0.15, 16]} />
        <meshToonMaterial {...baseToon} side={THREE.DoubleSide} />
      </mesh>
      {/* Paint dots */}
      {colors.map((col, i) => {
        const angle = (i / colors.length) * Math.PI * 2
        const r = 0.08
        return (
          <mesh key={`col-${i}`} position={[Math.cos(angle) * r, 0.02, Math.sin(angle) * r]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshToonMaterial {...getToonMaterialProps(col)} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Mood board on wall */
function MoodBoard({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const frameToon = getToonMaterialProps('#555555')
  const boardToon = getToonMaterialProps('#333333')
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#F97316', '#60A5FA']

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.8, 0.04]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <boxGeometry args={[1.1, 0.7, 0.005]} />
        <meshToonMaterial {...boardToon} />
      </mesh>
      {/* Pinned swatches/images */}
      {colors.map((col, i) => {
        const col2 = Math.floor(i / 2)
        const row = i % 2
        return (
          <mesh key={`col-${i}`} position={[-0.35 + col2 * 0.35, 0.12 - row * 0.3, 0.03]}>
            <boxGeometry args={[0.25, 0.2, 0.005]} />
            <meshToonMaterial {...getToonMaterialProps(col)} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Presentation screen on wall */
function PresentationScreen({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const frameToon = getToonMaterialProps('#333333')

  return (
    <group position={position} rotation={rotation}>
      {/* Frame */}
      <mesh castShadow>
        <boxGeometry args={[1.8, 1.1, 0.05]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 0, 0.026]}>
        <boxGeometry args={[1.65, 0.95, 0.005]} />
        <meshStandardMaterial color="#E0E8F0" emissive="#8090A0" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

/** 3D bar chart prop */
function BarChart({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const baseToon = getToonMaterialProps('#555555')
  const bars = [
    { h: 0.3, color: '#FF6B6B' },
    { h: 0.6, color: '#4ECDC4' },
    { h: 0.45, color: '#FFE66D' },
    { h: 0.8, color: '#A78BFA' },
    { h: 0.55, color: '#34D399' },
  ]

  return (
    <group position={position} rotation={rotation}>
      {/* Base plate */}
      <mesh position={[0, 0.01, 0]} castShadow>
        <boxGeometry args={[0.8, 0.02, 0.3]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      {/* Bars */}
      {bars.map((bar, i) => (
        <mesh key={`bar-${i}`} position={[-0.28 + i * 0.14, bar.h / 2 + 0.02, 0]} castShadow>
          <boxGeometry args={[0.1, bar.h, 0.18]} />
          <meshToonMaterial {...getToonMaterialProps(bar.color)} />
        </mesh>
      ))}
    </group>
  )
}

/** Megaphone prop */
function Megaphone({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const bodyToon = getToonMaterialProps('#FF8C00')
  const bellToon = getToonMaterialProps('#FFB347')

  return (
    <group position={position} rotation={rotation}>
      {/* Handle */}
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.15, 8]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      {/* Cone bell */}
      <mesh position={[0.15, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[0.1, 0.2, 8]} />
        <meshToonMaterial {...bellToon} />
      </mesh>
    </group>
  )
}

/** Standing desk (taller desk) */
function StandingDesk({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const topToon = getToonMaterialProps(WARM_COLORS.woodLight)
  const metalToon = getToonMaterialProps('#666666')

  const topWidth = 1.4
  const topDepth = 0.7
  const topHeight = 1.05

  return (
    <group position={position} rotation={rotation}>
      {/* Table top */}
      <mesh position={[0, topHeight, 0]} castShadow>
        <boxGeometry args={[topWidth, 0.06, topDepth]} />
        <meshToonMaterial {...topToon} />
      </mesh>
      {/* Two pillar legs */}
      <mesh position={[-topWidth / 2 + 0.15, topHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.08, topHeight, 0.08]} />
        <meshToonMaterial {...metalToon} />
      </mesh>
      <mesh position={[topWidth / 2 - 0.15, topHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.08, topHeight, 0.08]} />
        <meshToonMaterial {...metalToon} />
      </mesh>
      {/* Base feet */}
      <mesh position={[-topWidth / 2 + 0.15, 0.02, 0]} castShadow>
        <boxGeometry args={[0.3, 0.04, topDepth]} />
        <meshToonMaterial {...metalToon} />
      </mesh>
      <mesh position={[topWidth / 2 - 0.15, 0.02, 0]} castShadow>
        <boxGeometry args={[0.3, 0.04, topDepth]} />
        <meshToonMaterial {...metalToon} />
      </mesh>
    </group>
  )
}

/** Round table */
function RoundTable({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const topToon = getToonMaterialProps(WARM_COLORS.woodLight)
  const legToon = getToonMaterialProps(WARM_COLORS.wood)

  return (
    <group position={position} rotation={rotation}>
      {/* Table top */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 0.06, 20]} />
        <meshToonMaterial {...topToon} />
      </mesh>
      {/* Central pedestal */}
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.5, 10]} />
        <meshToonMaterial {...legToon} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.06, 12]} />
        <meshToonMaterial {...legToon} />
      </mesh>
    </group>
  )
}

/** Bean bag (squashed sphere) */
function BeanBag({
  position,
  color = '#6366F1',
}: {
  readonly position: [number, number, number]
  readonly color?: string
}) {
  const toon = getToonMaterialProps(color)

  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.55, 1]} castShadow>
        <sphereGeometry args={[0.35, 10, 10]} />
        <meshToonMaterial {...toon} />
      </mesh>
      {/* Back cushion bump */}
      <mesh position={[0, 0.28, -0.15]} scale={[0.8, 0.7, 0.5]} castShadow>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshToonMaterial {...toon} />
      </mesh>
    </group>
  )
}

/** Bookshelf (stacked boxes) */
function Bookshelf({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const shelfToon = getToonMaterialProps(WARM_COLORS.wood)
  const bookColors = [
    '#E74C3C',
    '#3498DB',
    '#2ECC71',
    '#F39C12',
    '#9B59B6',
    '#1ABC9C',
    '#E67E22',
    '#2980B9',
  ]

  return (
    <group position={position} rotation={rotation}>
      {/* Shelf frame sides */}
      <mesh position={[-0.45, 0.7, 0]} castShadow>
        <boxGeometry args={[0.04, 1.4, 0.3]} />
        <meshToonMaterial {...shelfToon} />
      </mesh>
      <mesh position={[0.45, 0.7, 0]} castShadow>
        <boxGeometry args={[0.04, 1.4, 0.3]} />
        <meshToonMaterial {...shelfToon} />
      </mesh>
      {/* Shelves (3 horizontal) */}
      {[0.02, 0.48, 0.94, 1.4].map((y, i) => (
        <mesh key={`y-${i}`} position={[0, y, 0]} castShadow>
          <boxGeometry args={[0.92, 0.04, 0.3]} />
          <meshToonMaterial {...shelfToon} />
        </mesh>
      ))}
      {/* Books on each shelf */}
      {[0.06, 0.52, 0.98].map((shelfY, si) => (
        <group key={si}>
          {bookColors.slice(si * 3, si * 3 + 3).map((col, bi) => (
            <mesh key={bi} position={[-0.25 + bi * 0.22, shelfY + 0.16, 0]} castShadow>
              <boxGeometry args={[0.12, 0.28, 0.2]} />
              <meshToonMaterial {...getToonMaterialProps(col)} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Wall clock */
function WallClock({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const frameToon = getToonMaterialProps('#333333')
  const faceToon = getToonMaterialProps('#FFFFF0')
  const handRef1 = useRef<THREE.Mesh>(null)
  const handRef2 = useRef<THREE.Mesh>(null)
  const clockFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    // Throttle: update every 3rd frame (clock hands move slowly anyway)
    if (++clockFrameSkip.current % 3 !== 0) return
    const t = clock.getElapsedTime()
    if (handRef1.current) handRef1.current.rotation.z = -t * 0.5 // minute hand
    if (handRef2.current) handRef2.current.rotation.z = -t * 0.04 // hour hand
  })

  return (
    <group position={position} rotation={rotation}>
      {/* Frame ring */}
      <mesh castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.06, 24]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      {/* Face */}
      <mesh position={[0, 0, 0.031]}>
        <cylinderGeometry args={[0.4, 0.4, 0.005, 24]} />
        <meshToonMaterial {...faceToon} />
      </mesh>
      {/* Hour marks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const r = 0.33
        return (
          <mesh key={`item-${i}`} position={[Math.sin(angle) * r, Math.cos(angle) * r, 0.035]}>
            <boxGeometry args={[0.02, 0.06, 0.005]} />
            <meshToonMaterial {...frameToon} />
          </mesh>
        )
      })}
      {/* Minute hand */}
      <mesh ref={handRef1} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.015, 0.28, 0.005]} />
        <meshToonMaterial {...getToonMaterialProps('#222222')} />
      </mesh>
      {/* Hour hand */}
      <mesh ref={handRef2} position={[0, 0, 0.042]}>
        <boxGeometry args={[0.02, 0.2, 0.005]} />
        <meshToonMaterial {...getToonMaterialProps('#222222')} />
      </mesh>
      {/* Center dot */}
      <mesh position={[0, 0, 0.045]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshToonMaterial {...getToonMaterialProps('#CC3333')} />
      </mesh>
    </group>
  )
}

/** Small monitor screen (for dashboards) */
function SmallScreen({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const frameToon = getToonMaterialProps('#2A2A2A')

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.35, 0.03]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <boxGeometry args={[0.44, 0.29, 0.005]} />
        <meshStandardMaterial color="#D0E8FF" emissive="#6090C0" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

/** Conveyor belt with small boxes */
function ConveyorBelt({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const beltToon = getToonMaterialProps('#444444')
  const frameToon = getToonMaterialProps('#666666')
  const boxColors = ['#FF8C00', '#4ECDC4', '#A78BFA']

  return (
    <group position={position} rotation={rotation}>
      {/* Belt base */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[2, 0.06, 0.4]} />
        <meshToonMaterial {...beltToon} />
      </mesh>
      {/* Side rails */}
      <mesh position={[0, 0.2, 0.22]} castShadow>
        <boxGeometry args={[2, 0.04, 0.04]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0.2, -0.22]} castShadow>
        <boxGeometry args={[2, 0.04, 0.04]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      {/* Legs */}
      {[-0.85, 0, 0.85].map((x, i) => (
        <mesh key={`x-${i}`} position={[x, 0.07, 0]} castShadow>
          <boxGeometry args={[0.06, 0.14, 0.4]} />
          <meshToonMaterial {...frameToon} />
        </mesh>
      ))}
      {/* Boxes on belt */}
      {boxColors.map((col, i) => (
        <mesh key={`x-${i}`} position={[-0.5 + i * 0.5, 0.28, 0]} castShadow>
          <boxGeometry args={[0.2, 0.18, 0.18]} />
          <meshToonMaterial {...getToonMaterialProps(col)} />
        </mesh>
      ))}
    </group>
  )
}

/** Gear mechanism */
function GearMechanism({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const gearToon = getToonMaterialProps('#777777')
  const gear1Ref = useRef<THREE.Group>(null)
  const gear2Ref = useRef<THREE.Group>(null)
  const gearFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    // Throttle: update every 2nd frame
    if (++gearFrameSkip.current % 2 !== 0) return
    const t = clock.getElapsedTime()
    if (gear1Ref.current) gear1Ref.current.rotation.z = t * 0.5
    if (gear2Ref.current) gear2Ref.current.rotation.z = -t * 0.5
  })

  return (
    <group position={position} rotation={rotation}>
      {/* Gear 1 */}
      <group ref={gear1Ref} position={[-0.18, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 12]} />
          <meshToonMaterial {...gearToon} />
        </mesh>
        {/* Teeth */}
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2
          return (
            <mesh key={`item-${i}`} position={[Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, 0]}>
              <boxGeometry args={[0.06, 0.06, 0.06]} />
              <meshToonMaterial {...gearToon} />
            </mesh>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.08, 8]} />
          <meshToonMaterial {...getToonMaterialProps('#555555')} />
        </mesh>
      </group>
      {/* Gear 2 (smaller) */}
      <group ref={gear2Ref} position={[0.2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.14, 0.14, 0.06, 10]} />
          <meshToonMaterial {...gearToon} />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2
          return (
            <mesh key={`item-${i}`} position={[Math.cos(angle) * 0.16, Math.sin(angle) * 0.16, 0]}>
              <boxGeometry args={[0.05, 0.05, 0.06]} />
              <meshToonMaterial {...gearToon} />
            </mesh>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
          <meshToonMaterial {...getToonMaterialProps('#555555')} />
        </mesh>
      </group>
    </group>
  )
}

/** Control panel (angled box with buttons) */
function ControlPanel({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const bodyToon = getToonMaterialProps('#3A3A3A')
  const panelToon = getToonMaterialProps('#4A4A4A')
  const buttonColors = ['#44AA44', '#CC3333', '#FFAA00', '#4488CC', '#44AA44', '#CC3333']

  return (
    <group position={position} rotation={rotation}>
      {/* Base */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.8, 0.7, 0.4]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      {/* Angled top panel */}
      <mesh position={[0, 0.72, 0.05]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.35, 0.04]} />
        <meshToonMaterial {...panelToon} />
      </mesh>
      {/* Buttons on panel */}
      {buttonColors.map((col, i) => {
        const row = Math.floor(i / 3)
        const colIdx = i % 3
        return (
          <mesh
            key={`col-${i}`}
            position={[-0.15 + colIdx * 0.15, 0.78 - row * 0.1, 0.12 - row * 0.06]}
            rotation={[-0.4, 0, 0]}
          >
            <cylinderGeometry args={[0.025, 0.025, 0.02, 8]} />
            <meshStandardMaterial color={col} emissive={col} emissiveIntensity={0.3} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Satellite dish */
function SatelliteDish({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const dishToon = getToonMaterialProps('#CCCCCC')
  const armToon = getToonMaterialProps('#888888')

  return (
    <group position={position} rotation={rotation}>
      {/* Dish (half sphere) */}
      <mesh rotation={[-0.5, 0, 0]} castShadow>
        <sphereGeometry args={[0.4, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial {...dishToon} side={THREE.DoubleSide} />
      </mesh>
      {/* Support arm */}
      <mesh position={[0, -0.15, 0.2]} rotation={[-0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
        <meshToonMaterial {...armToon} />
      </mesh>
      {/* Feed horn (small cone at focus point) */}
      <mesh position={[0, 0.15, 0.25]} rotation={[-0.5, 0, 0]} castShadow>
        <coneGeometry args={[0.04, 0.08, 6]} />
        <meshToonMaterial {...armToon} />
      </mesh>
      {/* Mount pole */}
      <mesh position={[0, -0.4, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.5, 6]} />
        <meshToonMaterial {...armToon} />
      </mesh>
    </group>
  )
}

/** Antenna tower (tall thin cylinder with rings) */
function AntennaTower({ position }: { position: [number, number, number] }) {
  const poleToon = getToonMaterialProps('#777777')
  const ringToon = getToonMaterialProps('#999999')

  return (
    <group position={position}>
      {/* Main pole */}
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 1.8, 8]} />
        <meshToonMaterial {...poleToon} />
      </mesh>
      {/* Rings at intervals */}
      {[0.5, 1, 1.4].map((y, i) => (
        <mesh key={`y-${i}`} position={[0, y, 0]}>
          <torusGeometry args={[0.08 + i * 0.02, 0.01, 6, 12]} />
          <meshToonMaterial {...ringToon} />
        </mesh>
      ))}
      {/* Top light */}
      <mesh position={[0, 1.82, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#FF3333" emissive="#FF3333" emissiveIntensity={0.6} />
      </mesh>
      <pointLight position={[0, 1.82, 0]} intensity={0.15} color="#FF3333" distance={3} />
    </group>
  )
}

/** Headset on desk */
function Headset({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const bandToon = getToonMaterialProps('#333333')
  const earToon = getToonMaterialProps('#444444')
  const cushionToon = getToonMaterialProps('#555555')

  return (
    <group position={position} rotation={rotation}>
      {/* Headband arc */}
      <mesh position={[0, 0.12, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.1, 0.015, 8, 12, Math.PI]} />
        <meshToonMaterial {...bandToon} />
      </mesh>
      {/* Left ear cup */}
      <mesh position={[-0.1, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
        <meshToonMaterial {...earToon} />
      </mesh>
      <mesh position={[-0.1, 0.02, 0.02]}>
        <cylinderGeometry args={[0.04, 0.04, 0.01, 10]} />
        <meshToonMaterial {...cushionToon} />
      </mesh>
      {/* Right ear cup */}
      <mesh position={[0.1, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
        <meshToonMaterial {...earToon} />
      </mesh>
      <mesh position={[0.1, 0.02, 0.02]}>
        <cylinderGeometry args={[0.04, 0.04, 0.01, 10]} />
        <meshToonMaterial {...cushionToon} />
      </mesh>
      {/* Mic boom */}
      <mesh position={[-0.1, -0.02, 0.05]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
        <meshToonMaterial {...bandToon} />
      </mesh>
      <mesh position={[-0.1, -0.08, 0.08]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshToonMaterial {...getToonMaterialProps('#222222')} />
      </mesh>
    </group>
  )
}

/** Signal wave rings (animated, transparent) */
function SignalWaves({ position }: { position: [number, number, number] }) {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)
  const waveFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    // Throttle: update every 2nd frame
    if (++waveFrameSkip.current % 2 !== 0) return
    const t = clock.getElapsedTime()
    const refs = [ring1Ref, ring2Ref, ring3Ref]
    refs.forEach((ref, i) => {
      if (ref.current) {
        const phase = (t * 0.8 + i * 0.7) % 2
        const scale = 0.5 + phase * 0.8
        ref.current.scale.set(scale, scale, scale)
        const mat = ref.current.material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 1 - phase / 2) * 0.4
      }
    })
  })

  return (
    <group position={position}>
      {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
        <mesh key={`ref-${i}`} ref={ref} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.02, 8, 24]} />
          <meshStandardMaterial
            color="#60A5FA"
            emissive="#60A5FA"
            emissiveIntensity={0.5}
            transparent
            opacity={0.4}
          />
        </mesh>
      ))}
    </group>
  )
}

/** Status lights (colored spheres) */
function StatusLights({ position }: { position: [number, number, number] }) {
  const lights = [
    { color: '#44CC44', x: -0.15 },
    { color: '#CCCC44', x: 0 },
    { color: '#CC4444', x: 0.15 },
  ]
  const poleToon = getToonMaterialProps('#666666')

  return (
    <group position={position}>
      {/* Mount bar */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.5, 0.06, 0.06]} />
        <meshToonMaterial {...poleToon} />
      </mesh>
      {lights.map((l, i) => (
        <mesh key={`l-${i}`} position={[l.x, 0, 0.04]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

/** Filing cabinet */
function FilingCabinet({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const bodyToon = getToonMaterialProps('#777777')
  const drawerToon = getToonMaterialProps('#888888')
  const handleToon = getToonMaterialProps('#AAAAAA')

  return (
    <group position={position} rotation={rotation}>
      {/* Body */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.45, 1.1, 0.4]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      {/* Drawer fronts */}
      {[0.18, 0.55, 0.92].map((y, i) => (
        <group key={`y-${i}`}>
          <mesh position={[0, y, 0.201]}>
            <boxGeometry args={[0.38, 0.28, 0.01]} />
            <meshToonMaterial {...drawerToon} />
          </mesh>
          {/* Handle */}
          <mesh position={[0, y, 0.22]}>
            <boxGeometry args={[0.12, 0.02, 0.02]} />
            <meshToonMaterial {...handleToon} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Fire extinguisher */
function FireExtinguisher({ position }: { position: [number, number, number] }) {
  const bodyToon = getToonMaterialProps('#CC2222')
  const topToon = getToonMaterialProps('#444444')

  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 10]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      {/* Top valve */}
      <mesh position={[0, 0.57, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.06, 8]} />
        <meshToonMaterial {...topToon} />
      </mesh>
      {/* Handle */}
      <mesh position={[0.05, 0.58, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.08, 0.02, 0.02]} />
        <meshToonMaterial {...topToon} />
      </mesh>
      {/* Hose */}
      <mesh position={[-0.06, 0.48, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.012, 0.012, 0.15, 6]} />
        <meshToonMaterial {...getToonMaterialProps('#333333')} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 10]} />
        <meshToonMaterial {...getToonMaterialProps('#333333')} />
      </mesh>
    </group>
  )
}

/** Drawing tablet on desk */
function DrawingTablet({
  position,
  rotation,
}: {
  readonly position: [number, number, number]
  readonly rotation?: [number, number, number]
}) {
  const baseToon = getToonMaterialProps('#2A2A2A')
  const penToon = getToonMaterialProps('#555555')

  return (
    <group position={position} rotation={rotation}>
      {/* Tablet body */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.4, 0.03, 0.3]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      {/* Active area */}
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[0.32, 0.005, 0.22]} />
        <meshStandardMaterial color="#404850" emissive="#203040" emissiveIntensity={0.15} />
      </mesh>
      {/* Stylus pen lying beside */}
      <mesh position={[0.25, 0.02, 0]} rotation={[0, 0.3, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.005, 0.18, 6]} />
        <meshToonMaterial {...penToon} />
      </mesh>
    </group>
  )
}

// ─── Room Type Components ───────────────────────────────────────

interface RoomTypeProps {
  readonly s: number // scale factor
  readonly size: number // room size
}

const Y = 0.16 // floor surface y offset

/** 1. Headquarters — main office / assistant's room */
function HeadquartersProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      {/* Large desk with monitor — back wall area */}
      <Desk position={[-h + 2.5 * s, Y, h - 2.5 * s]} rotation={[0, Math.PI / 4, 0]} />
      <Monitor position={[-h + 2.5 * s, Y + 0.78, h - 2.5 * s]} rotation={[0, Math.PI / 4, 0]} />

      {/* Office chair */}
      <Chair position={[-h + 3.5 * s, Y, h - 3.5 * s]} rotation={[0, Math.PI + Math.PI / 4, 0]} />

      {/* Plant in corner */}
      <Plant position={[h - 1.2 * s, Y, h - 1.2 * s]} scale={1.2 * s} />

      {/* Notice board on back wall */}
      <NoticeBoard position={[0, 1.8 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />

      {/* Coffee machine — side wall */}
      <CoffeeMachine position={[h - 1.5 * s, Y, -h + 2 * s]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Water cooler — opposite side */}
      <WaterCooler position={[-h + 1.5 * s, Y, -h + 2 * s]} />
    </group>
  )
}

/** 2. Dev Room — developer workspace */
function DevRoomProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      {/* Desk 1 with dual monitors — left side */}
      <Desk position={[-h + 2.5 * s, Y, h - 2.5 * s]} rotation={[0, Math.PI / 6, 0]} />
      <Monitor position={[-h + 2.3 * s, Y + 0.78, h - 2.4 * s]} rotation={[0, Math.PI / 6, 0]} />
      <Monitor position={[-h + 2.8 * s, Y + 0.78, h - 2.6 * s]} rotation={[0, Math.PI / 6, 0]} />
      <Chair position={[-h + 3.2 * s, Y, h - 3.5 * s]} rotation={[0, Math.PI + Math.PI / 6, 0]} />

      {/* Desk 2 with dual monitors — right side */}
      <Desk position={[h - 2.5 * s, Y, h - 2.5 * s]} rotation={[0, -Math.PI / 6, 0]} />
      <Monitor position={[h - 2.3 * s, Y + 0.78, h - 2.4 * s]} rotation={[0, -Math.PI / 6, 0]} />
      <Monitor position={[h - 2.8 * s, Y + 0.78, h - 2.6 * s]} rotation={[0, -Math.PI / 6, 0]} />
      <Chair position={[h - 3.2 * s, Y, h - 3.5 * s]} rotation={[0, Math.PI - Math.PI / 6, 0]} />

      {/* Server rack — back-right corner */}
      <ServerRack position={[h - 1.2 * s, Y, h - 1 * s]} rotation={[0, Math.PI, 0]} />

      {/* Whiteboard on back wall */}
      <Whiteboard position={[0, 1.6 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />

      {/* Cable mess on floor between desks */}
      <CableMess position={[0, Y, h - 3 * s]} />

      {/* Desk lamp on desk 1 */}
      <DeskLamp position={[-h + 1.8 * s, Y + 0.78, h - 2.2 * s]} />
    </group>
  )
}

/** 3. Creative Room — design/content */
function CreativeRoomProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      {/* Easel with canvas — center-left */}
      <Easel position={[-h + 2.5 * s, Y, 0]} rotation={[0, Math.PI / 3, 0]} />

      {/* Desk with monitor and drawing tablet — right side */}
      <Desk position={[h - 2.5 * s, Y, h - 2.5 * s]} rotation={[0, -Math.PI / 4, 0]} />
      <Monitor position={[h - 2.5 * s, Y + 0.78, h - 2.5 * s]} rotation={[0, -Math.PI / 4, 0]} />
      <DrawingTablet
        position={[h - 2.8 * s, Y + 0.78, h - 2.2 * s]}
        rotation={[0, -Math.PI / 4, 0]}
      />
      <Chair position={[h - 1.8 * s, Y, h - 3.2 * s]} rotation={[0, Math.PI - Math.PI / 4, 0]} />

      {/* Color palette on small table near easel */}
      <ColorPalette position={[-h + 3.5 * s, Y + 0.5, 0.3 * s]} />

      {/* Mood board on wall */}
      <MoodBoard position={[0, 1.6 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />

      {/* Plants for inspiration */}
      <Plant position={[h - 1.2 * s, Y, -h + 1.5 * s]} scale={1 * s} />
      <Plant position={[-h + 1.2 * s, Y, h - 1.2 * s]} scale={0.8 * s} potColor="#6B4F12" />
    </group>
  )
}

/** 4. Marketing Room — Flowy's room */
function MarketingRoomProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      {/* Standing desk with large monitor — center-back */}
      <StandingDesk position={[-h + 3 * s, Y, h - 2.5 * s]} rotation={[0, Math.PI / 6, 0]} />
      <Monitor position={[-h + 3 * s, Y + 1.1, h - 2.5 * s]} rotation={[0, Math.PI / 6, 0]} />

      {/* Presentation screen on wall */}
      <PresentationScreen position={[0, 1.8 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />

      {/* Bar chart prop — on a small table */}
      <BarChart position={[h - 2.5 * s, Y, 0]} rotation={[0, -Math.PI / 4, 0]} />

      {/* Megaphone on the standing desk */}
      <Megaphone position={[-h + 3.5 * s, Y + 1.12, h - 2.3 * s]} rotation={[0, Math.PI / 4, 0]} />

      {/* Plant */}
      <Plant position={[h - 1.2 * s, Y, h - 1.2 * s]} scale={1.1 * s} />

      {/* Chair (for guests) */}
      <Chair position={[h - 2.5 * s, Y, h - 3 * s]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}

/** 5. Thinking Room — strategy/planning */
function ThinkingRoomProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      {/* Round table — center */}
      <RoundTable position={[0, Y, 0]} />

      {/* Bean bags around the table */}
      <BeanBag position={[-1.5 * s, Y, -0.8 * s]} color="#6366F1" />
      <BeanBag position={[1.5 * s, Y, -0.5 * s]} color="#8B5CF6" />
      <BeanBag position={[0, Y, 1.5 * s]} color="#A78BFA" />
      <BeanBag position={[-1.2 * s, Y, 1 * s]} color="#7C3AED" />

      {/* Bookshelf — against back wall */}
      <Bookshelf position={[h - 1.2 * s, Y, h - 1 * s]} rotation={[0, Math.PI, 0]} />

      {/* Lamp — warm ambient light */}
      <Lamp position={[-h + 1.5 * s, Y, -h + 1.5 * s]} lightColor="#FFD700" lightIntensity={0.5} />

      {/* Whiteboard */}
      <Whiteboard position={[-h + 0.5 * s, 1.6 * s + Y, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}

/** 6. Automation Room — cron/scheduled tasks */
function AutomationRoomProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      {/* Large wall clock — prominent on back wall */}
      <WallClock position={[0, 2.2 * s + Y, h - 0.5 * s]} rotation={[Math.PI / 2, 0, Math.PI]} />

      {/* Dashboard wall — multiple small screens */}
      <SmallScreen position={[-1.2 * s, 1.6 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[1.2 * s, 1.6 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[-1.2 * s, 1.1 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[1.2 * s, 1.1 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />

      {/* Conveyor belt — center of room */}
      <ConveyorBelt position={[0, Y, -0.5 * s]} rotation={[0, 0, 0]} />

      {/* Gear mechanism on side wall */}
      <GearMechanism position={[h - 0.5 * s, 1.2 * s + Y, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Control panel — front area */}
      <ControlPanel position={[-h + 2 * s, Y, -h + 2 * s]} rotation={[0, Math.PI / 4, 0]} />
    </group>
  )
}

/** 7. Comms Room — communications */
function CommsRoomProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      {/* Satellite dish — top corner */}
      <SatelliteDish
        position={[h - 1.5 * s, 2 * s + Y, h - 1.5 * s]}
        rotation={[0, -Math.PI / 4, 0]}
      />

      {/* Antenna tower — back corner */}
      <AntennaTower position={[-h + 1.2 * s, Y, h - 1.2 * s]} />

      {/* Multiple screens on wall */}
      <SmallScreen position={[-0.8 * s, 1.6 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[0.5 * s, 1.6 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[-0.15 * s, 1.1 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />

      {/* Desk with headset */}
      <Desk position={[h - 2.5 * s, Y, -h + 2.5 * s]} rotation={[0, -Math.PI / 3, 0]} />
      <Monitor position={[h - 2.5 * s, Y + 0.78, -h + 2.5 * s]} rotation={[0, -Math.PI / 3, 0]} />
      <Headset position={[h - 2 * s, Y + 0.82, -h + 2.2 * s]} rotation={[0, -Math.PI / 3, 0]} />
      <Chair position={[h - 3.2 * s, Y, -h + 3.2 * s]} rotation={[0, (Math.PI * 2) / 3, 0]} />

      {/* Signal waves emanating from antenna */}
      <SignalWaves position={[-h + 1.2 * s, 2 * s + Y, h - 1.2 * s]} />
    </group>
  )
}

/** 8. Ops Room — operations/command center */
function OpsRoomProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      {/* Large central table with map/dashboard */}
      <RoundTable position={[0, Y, 0]} />
      {/* Dashboard surface on the table */}
      <mesh position={[0, Y + 0.59, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.85, 20]} />
        <meshStandardMaterial color="#1A2A3A" emissive="#203848" emissiveIntensity={0.3} />
      </mesh>

      {/* Multiple monitors — command center on back wall */}
      <SmallScreen position={[-1.3 * s, 1.8 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[0, 1.8 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[1.3 * s, 1.8 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[-0.65 * s, 1.2 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />
      <SmallScreen position={[0.65 * s, 1.2 * s + Y, h - 0.5 * s]} rotation={[0, Math.PI, 0]} />

      {/* Status lights — on side wall */}
      <StatusLights position={[h - 0.5 * s, 1.5 * s + Y, 0]} />
      <StatusLights position={[h - 0.5 * s, 1.1 * s + Y, 0]} />

      {/* Filing cabinets — back corner */}
      <FilingCabinet position={[-h + 1.2 * s, Y, h - 1.2 * s]} rotation={[0, Math.PI / 4, 0]} />
      <FilingCabinet position={[-h + 1.2 * s, Y, h - 2.2 * s]} rotation={[0, Math.PI / 4, 0]} />

      {/* Fire extinguisher — near entrance */}
      <FireExtinguisher position={[h - 1 * s, Y, -h + 1.2 * s]} />

      {/* Chairs around the central table */}
      <Chair position={[-1.5 * s, Y, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Chair position={[1.5 * s, Y, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <Chair position={[0, Y, -1.5 * s]} rotation={[0, 0, 0]} />
    </group>
  )
}

/** Default room — generic office fallback */
function DefaultRoomProps({ s, size }: Readonly<RoomTypeProps>) {
  const h = size / 2

  return (
    <group>
      <Desk position={[-h + 2.5 * s, Y, h - 2.5 * s]} rotation={[0, Math.PI / 4, 0]} />
      <Monitor position={[-h + 2.5 * s, Y + 0.78, h - 2.5 * s]} rotation={[0, Math.PI / 4, 0]} />
      <Chair position={[-h + 3.5 * s, Y, h - 3.5 * s]} rotation={[0, Math.PI + Math.PI / 4, 0]} />
      <Lamp position={[h - 1.5 * s, Y, -h + 2 * s]} lightColor="#FFD700" lightIntensity={0.4} />
      <Plant position={[h - 1.2 * s, Y, h - 1.2 * s]} scale={1 * s} />
    </group>
  )
}

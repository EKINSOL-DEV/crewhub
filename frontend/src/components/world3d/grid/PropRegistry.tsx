// ─── Prop Registry ──────────────────────────────────────────────
// Maps grid propId strings to Three.js components.
// Geometry extracted from RoomProps.tsx mini-props + existing /props/ components.

import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Desk } from '../props/Desk'
import { Monitor } from '../props/Monitor'
import { Chair } from '../props/Chair'
import { Lamp } from '../props/Lamp'
import { Plant } from '../props/Plant'
import { CoffeeMachine } from '../props/CoffeeMachine'
import { WaterCooler } from '../props/WaterCooler'
import { NoticeBoard } from '../props/NoticeBoard'
import { Bench } from '../props/Bench'
import { useToonMaterialProps, WARM_COLORS } from '../utils/toonMaterials'

// ─── Prop Component Interface ───────────────────────────────────

export type MountType = 'floor' | 'wall'

export interface PropProps {
  position: [number, number, number]
  rotation: number  // degrees (0, 90, 180, 270)
  cellSize: number
  span?: { w: number; d: number }
}

export interface PropEntry {
  component: React.FC<PropProps>
  /** Mount type determines positioning behaviour:
   *  - 'floor': sits on the floor. yOffset is height of floor surface (typically 0.16).
   *  - 'wall': mounted on wall. yOffset is the wall-mount height (center of prop).
   *    Renderer handles wall-snapping and rotation for wall props.
   */
  mountType: MountType
  /** Y position offset from room base. Floor props: 0.16 (floor surface).
   *  Wall props: mount height (e.g., 1.2 for whiteboards, 2.2 for clocks). */
  yOffset: number
}

/** Convert degree rotation to [0, radians, 0] euler */
function degToEuler(deg: number): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

// ─── Wrapper Components ─────────────────────────────────────────
// Wrap existing prop components to match the PropProps interface

function DeskProp({ position, rotation }: PropProps) {
  return <Desk position={position} rotation={degToEuler(rotation)} />
}

function MonitorProp({ position, rotation }: PropProps) {
  return <Monitor position={[position[0], position[1] + 0.78, position[2]]} rotation={degToEuler(rotation)} />
}

function ChairProp({ position, rotation }: PropProps) {
  return <Chair position={position} rotation={degToEuler(rotation)} />
}

function LampProp({ position }: PropProps) {
  return <Lamp position={position} lightColor="#FFD700" lightIntensity={0.4} />
}

function PlantProp({ position }: PropProps) {
  return <Plant position={position} scale={1.0} />
}

function CoffeeMachineProp({ position, rotation }: PropProps) {
  return <CoffeeMachine position={position} rotation={degToEuler(rotation)} />
}

function WaterCoolerProp({ position, rotation }: PropProps) {
  return <WaterCooler position={position} rotation={degToEuler(rotation)} />
}

function NoticeBoardProp({ position, rotation }: PropProps) {
  return <NoticeBoard position={position} rotation={degToEuler(rotation)} />
}

function BenchProp({ position, rotation }: PropProps) {
  return <Bench position={position} rotation={degToEuler(rotation)} />
}

// ─── Mini-Prop Components (from RoomProps.tsx) ──────────────────

function WhiteboardProp({ position, rotation }: PropProps) {
  const frameToon = useToonMaterialProps('#888888')
  const boardToon = useToonMaterialProps('#F5F5F5')
  const trayToon = useToonMaterialProps('#666666')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 1.0, 0.05]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <boxGeometry args={[1.45, 0.85, 0.005]} />
        <meshToonMaterial {...boardToon} />
      </mesh>
      <mesh position={[0, -0.52, 0.04]}>
        <boxGeometry args={[0.8, 0.04, 0.06]} />
        <meshToonMaterial {...trayToon} />
      </mesh>
    </group>
  )
}

function ServerRackProp({ position, rotation }: PropProps) {
  const bodyToon = useToonMaterialProps('#2A2A2A')
  const rackToon = useToonMaterialProps('#1A1A1A')
  const slotToon = useToonMaterialProps('#333333')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[0.6, 1.8, 0.5]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      <mesh position={[0, 0.9, 0.251]}>
        <boxGeometry args={[0.5, 1.6, 0.01]} />
        <meshToonMaterial {...rackToon} />
      </mesh>
      {[0.3, 0.6, 0.9, 1.2, 1.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0.26]}>
          <boxGeometry args={[0.44, 0.08, 0.01]} />
          <meshToonMaterial {...slotToon} />
        </mesh>
      ))}
      <ServerLED position={[0.18, 0.35, 0.27]} color="#00FF44" />
      <ServerLED position={[0.18, 0.65, 0.27]} color="#00FF44" />
      <ServerLED position={[0.18, 0.95, 0.27]} color="#FFAA00" />
      <ServerLED position={[0.18, 1.25, 0.27]} color="#00FF44" />
      <ServerLED position={[0.18, 1.55, 0.27]} color="#00FF44" />
    </group>
  )
}

function ServerLED({ position, color }: { position: [number, number, number]; color: string }) {
  const ref = useRef<THREE.Mesh>(null)
  const blinkSpeed = useMemo(() => 2 + Math.random() * 0.5, [])
  const frameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (!ref.current) return
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

function DeskLampProp({ position, rotation }: PropProps) {
  const baseToon = useToonMaterialProps('#444444')
  const armToon = useToonMaterialProps('#555555')
  const shadeToon = useToonMaterialProps('#888888')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.04, 10]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0.2]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 6]} />
        <meshToonMaterial {...armToon} />
      </mesh>
      <mesh position={[0.06, 0.38, 0]} rotation={[0, 0, 0.2]} castShadow>
        <coneGeometry args={[0.08, 0.1, 8, 1, true]} />
        <meshToonMaterial {...shadeToon} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0.06, 0.35, 0]} intensity={0.2} color="#FFE4B5" distance={3} />
    </group>
  )
}

function CableMessProp({ position }: PropProps) {
  const cableToon = useToonMaterialProps('#222222')
  const cableRedToon = useToonMaterialProps('#993333')
  const cableBlueToon = useToonMaterialProps('#334499')

  const cables = [
    { pos: [0, 0.01, 0] as [number, number, number], rot: [Math.PI / 2, 0, 0.3] as [number, number, number], toon: cableToon, len: 0.8 },
    { pos: [0.15, 0.01, 0.1] as [number, number, number], rot: [Math.PI / 2, 0, -0.5] as [number, number, number], toon: cableRedToon, len: 0.6 },
    { pos: [-0.1, 0.01, -0.05] as [number, number, number], rot: [Math.PI / 2, 0, 1.2] as [number, number, number], toon: cableBlueToon, len: 0.5 },
    { pos: [0.05, 0.015, 0.15] as [number, number, number], rot: [Math.PI / 2, 0, -0.1] as [number, number, number], toon: cableToon, len: 0.7 },
  ]

  return (
    <group position={position}>
      {cables.map((c, i) => (
        <mesh key={i} position={c.pos} rotation={c.rot}>
          <cylinderGeometry args={[0.012, 0.012, c.len, 6]} />
          <meshToonMaterial {...c.toon} />
        </mesh>
      ))}
    </group>
  )
}

function EaselProp({ position, rotation }: PropProps) {
  const woodToon = useToonMaterialProps(WARM_COLORS.wood)
  const canvasToon = useToonMaterialProps('#FFFFF0')
  const paint1 = useToonMaterialProps('#FF6B6B')
  const paint2 = useToonMaterialProps('#4ECDC4')
  const paint3 = useToonMaterialProps('#FFE66D')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[-0.2, 0.6, 0]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[0.04, 1.2, 0.04]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      <mesh position={[0.2, 0.6, 0]} rotation={[0, 0, -0.1]} castShadow>
        <boxGeometry args={[0.04, 1.2, 0.04]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      <mesh position={[0, 0.5, -0.2]} rotation={[0.3, 0, 0]} castShadow>
        <boxGeometry args={[0.04, 1.0, 0.04]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.5, 0.04, 0.04]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      <mesh position={[0, 0.5, 0.02]} castShadow>
        <boxGeometry args={[0.5, 0.03, 0.06]} />
        <meshToonMaterial {...woodToon} />
      </mesh>
      <mesh position={[0, 0.85, 0.04]} castShadow>
        <boxGeometry args={[0.7, 0.55, 0.03]} />
        <meshToonMaterial {...canvasToon} />
      </mesh>
      <mesh position={[-0.1, 0.9, 0.06]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshToonMaterial {...paint1} />
      </mesh>
      <mesh position={[0.12, 0.8, 0.06]}>
        <sphereGeometry args={[0.05, 6, 6]} />
        <meshToonMaterial {...paint2} />
      </mesh>
      <mesh position={[0.0, 0.75, 0.06]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshToonMaterial {...paint3} />
      </mesh>
    </group>
  )
}

function ColorPaletteProp({ position, rotation }: PropProps) {
  const baseToon = useToonMaterialProps(WARM_COLORS.woodLight)
  const stoolToon = useToonMaterialProps(WARM_COLORS.wood)
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#34D399', '#F97316', '#FFFFFF']

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      {/* Small stool/stand to hold the palette */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.4, 8]} />
        <meshToonMaterial {...stoolToon} />
      </mesh>
      {/* Palette on top of stool */}
      <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <circleGeometry args={[0.15, 16]} />
        <meshToonMaterial {...baseToon} side={THREE.DoubleSide} />
      </mesh>
      {colors.map((col, i) => {
        const angle = (i / colors.length) * Math.PI * 2
        const r = 0.08
        return (
          <mesh key={i} position={[Math.cos(angle) * r, 0.42, Math.sin(angle) * r]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshToonMaterial {...useToonMaterialProps(col)} />
          </mesh>
        )
      })}
    </group>
  )
}

function MoodBoardProp({ position, rotation }: PropProps) {
  const frameToon = useToonMaterialProps('#555555')
  const boardToon = useToonMaterialProps('#333333')
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#F97316', '#60A5FA']

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.8, 0.04]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <boxGeometry args={[1.1, 0.7, 0.005]} />
        <meshToonMaterial {...boardToon} />
      </mesh>
      {colors.map((col, i) => {
        const col2 = Math.floor(i / 2)
        const row = i % 2
        return (
          <mesh key={i} position={[-0.35 + col2 * 0.35, 0.12 - row * 0.3, 0.03]}>
            <boxGeometry args={[0.25, 0.2, 0.005]} />
            <meshToonMaterial {...useToonMaterialProps(col)} />
          </mesh>
        )
      })}
    </group>
  )
}

function PresentationScreenProp({ position, rotation }: PropProps) {
  const frameToon = useToonMaterialProps('#333333')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh castShadow>
        <boxGeometry args={[1.8, 1.1, 0.05]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0, 0.026]}>
        <boxGeometry args={[1.65, 0.95, 0.005]} />
        <meshStandardMaterial color="#E0E8F0" emissive="#8090A0" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

function BarChartProp({ position, rotation }: PropProps) {
  const baseToon = useToonMaterialProps('#555555')
  const bars = [
    { h: 0.3, color: '#FF6B6B' },
    { h: 0.6, color: '#4ECDC4' },
    { h: 0.45, color: '#FFE66D' },
    { h: 0.8, color: '#A78BFA' },
    { h: 0.55, color: '#34D399' },
  ]

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.01, 0]} castShadow>
        <boxGeometry args={[0.8, 0.02, 0.3]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      {bars.map((bar, i) => (
        <mesh key={i} position={[-0.28 + i * 0.14, bar.h / 2 + 0.02, 0]} castShadow>
          <boxGeometry args={[0.1, bar.h, 0.18]} />
          <meshToonMaterial {...useToonMaterialProps(bar.color)} />
        </mesh>
      ))}
    </group>
  )
}

function MegaphoneProp({ position, rotation }: PropProps) {
  const bodyToon = useToonMaterialProps('#FF8C00')
  const bellToon = useToonMaterialProps('#FFB347')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.05, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.15, 8]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      <mesh position={[0.15, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow>
        <coneGeometry args={[0.1, 0.2, 8]} />
        <meshToonMaterial {...bellToon} />
      </mesh>
    </group>
  )
}

function StandingDeskProp({ position, rotation }: PropProps) {
  const topToon = useToonMaterialProps(WARM_COLORS.woodLight)
  const metalToon = useToonMaterialProps('#666666')
  const topWidth = 1.4
  const topDepth = 0.7
  const topHeight = 1.05

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, topHeight, 0]} castShadow>
        <boxGeometry args={[topWidth, 0.06, topDepth]} />
        <meshToonMaterial {...topToon} />
      </mesh>
      <mesh position={[-topWidth / 2 + 0.15, topHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.08, topHeight, 0.08]} />
        <meshToonMaterial {...metalToon} />
      </mesh>
      <mesh position={[topWidth / 2 - 0.15, topHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.08, topHeight, 0.08]} />
        <meshToonMaterial {...metalToon} />
      </mesh>
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

function RoundTableProp({ position, rotation }: PropProps) {
  const topToon = useToonMaterialProps(WARM_COLORS.woodLight)
  const legToon = useToonMaterialProps(WARM_COLORS.wood)

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[1.0, 1.0, 0.06, 20]} />
        <meshToonMaterial {...topToon} />
      </mesh>
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 0.5, 10]} />
        <meshToonMaterial {...legToon} />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.06, 12]} />
        <meshToonMaterial {...legToon} />
      </mesh>
    </group>
  )
}

function BeanBagProp(props: PropProps) {
  const { position } = props
  const colors = ['#6366F1', '#8B5CF6', '#A78BFA', '#7C3AED']
  // Stable color per instance based on position hash
  const colorIndex = Math.abs(Math.round(position[0] * 7 + position[2] * 13)) % colors.length
  const toon = useToonMaterialProps(colors[colorIndex])

  return (
    <group position={position}>
      <mesh position={[0, 0.2, 0]} scale={[1, 0.55, 1]} castShadow>
        <sphereGeometry args={[0.35, 10, 10]} />
        <meshToonMaterial {...toon} />
      </mesh>
      <mesh position={[0, 0.28, -0.15]} scale={[0.8, 0.7, 0.5]} castShadow>
        <sphereGeometry args={[0.25, 8, 8]} />
        <meshToonMaterial {...toon} />
      </mesh>
    </group>
  )
}

function BookshelfProp({ position, rotation }: PropProps) {
  const shelfToon = useToonMaterialProps(WARM_COLORS.wood)
  const bookColors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#2980B9']

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[-0.45, 0.7, 0]} castShadow>
        <boxGeometry args={[0.04, 1.4, 0.3]} />
        <meshToonMaterial {...shelfToon} />
      </mesh>
      <mesh position={[0.45, 0.7, 0]} castShadow>
        <boxGeometry args={[0.04, 1.4, 0.3]} />
        <meshToonMaterial {...shelfToon} />
      </mesh>
      {[0.02, 0.48, 0.94, 1.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} castShadow>
          <boxGeometry args={[0.92, 0.04, 0.3]} />
          <meshToonMaterial {...shelfToon} />
        </mesh>
      ))}
      {[0.06, 0.52, 0.98].map((shelfY, si) => (
        <group key={si}>
          {bookColors.slice(si * 3, si * 3 + 3).map((col, bi) => (
            <mesh key={bi} position={[-0.25 + bi * 0.22, shelfY + 0.16, 0]} castShadow>
              <boxGeometry args={[0.12, 0.28, 0.2]} />
              <meshToonMaterial {...useToonMaterialProps(col)} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function WallClockProp({ position }: PropProps) {
  const frameToon = useToonMaterialProps('#333333')
  const faceToon = useToonMaterialProps('#FFFFF0')
  const handToon = useToonMaterialProps('#222222')
  const centerToon = useToonMaterialProps('#CC3333')
  const handRef1 = useRef<THREE.Mesh>(null)
  const handRef2 = useRef<THREE.Mesh>(null)
  const clockFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (++clockFrameSkip.current % 3 !== 0) return
    const t = clock.getElapsedTime()
    if (handRef1.current) handRef1.current.rotation.z = -t * 0.5
    if (handRef2.current) handRef2.current.rotation.z = -t * 0.04
  })

  return (
    <group position={position} rotation={[Math.PI / 2, 0, Math.PI]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.06, 24]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0, 0.031]}>
        <cylinderGeometry args={[0.4, 0.4, 0.005, 24]} />
        <meshToonMaterial {...faceToon} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const r = 0.33
        return (
          <mesh key={i} position={[Math.sin(angle) * r, Math.cos(angle) * r, 0.035]}>
            <boxGeometry args={[0.02, 0.06, 0.005]} />
            <meshToonMaterial {...frameToon} />
          </mesh>
        )
      })}
      <mesh ref={handRef1} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.015, 0.28, 0.005]} />
        <meshToonMaterial {...handToon} />
      </mesh>
      <mesh ref={handRef2} position={[0, 0, 0.042]}>
        <boxGeometry args={[0.02, 0.2, 0.005]} />
        <meshToonMaterial {...handToon} />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshToonMaterial {...centerToon} />
      </mesh>
    </group>
  )
}

function SmallScreenProp({ position, rotation }: PropProps) {
  const frameToon = useToonMaterialProps('#2A2A2A')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
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

function ConveyorBeltProp({ position, rotation }: PropProps) {
  const beltToon = useToonMaterialProps('#444444')
  const frameToon = useToonMaterialProps('#666666')
  const boxColors = ['#FF8C00', '#4ECDC4', '#A78BFA']

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[2.0, 0.06, 0.4]} />
        <meshToonMaterial {...beltToon} />
      </mesh>
      <mesh position={[0, 0.2, 0.22]} castShadow>
        <boxGeometry args={[2.0, 0.04, 0.04]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0.2, -0.22]} castShadow>
        <boxGeometry args={[2.0, 0.04, 0.04]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      {[-0.85, 0, 0.85].map((x, i) => (
        <mesh key={i} position={[x, 0.07, 0]} castShadow>
          <boxGeometry args={[0.06, 0.14, 0.4]} />
          <meshToonMaterial {...frameToon} />
        </mesh>
      ))}
      {boxColors.map((col, i) => (
        <mesh key={i} position={[-0.5 + i * 0.5, 0.28, 0]} castShadow>
          <boxGeometry args={[0.2, 0.18, 0.18]} />
          <meshToonMaterial {...useToonMaterialProps(col)} />
        </mesh>
      ))}
    </group>
  )
}

function GearMechanismProp({ position, rotation }: PropProps) {
  const gearToon = useToonMaterialProps('#777777')
  const axleToon = useToonMaterialProps('#555555')
  const gear1Ref = useRef<THREE.Group>(null)
  const gear2Ref = useRef<THREE.Group>(null)
  const gearFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (++gearFrameSkip.current % 2 !== 0) return
    const t = clock.getElapsedTime()
    if (gear1Ref.current) gear1Ref.current.rotation.z = t * 0.5
    if (gear2Ref.current) gear2Ref.current.rotation.z = -t * 0.5
  })

  return (
    <group position={position} rotation={degToEuler(rotation === 0 ? 270 : rotation)}>
      <group ref={gear1Ref} position={[-0.18, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 12]} />
          <meshToonMaterial {...gearToon} />
        </mesh>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, 0]}>
              <boxGeometry args={[0.06, 0.06, 0.06]} />
              <meshToonMaterial {...gearToon} />
            </mesh>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.08, 8]} />
          <meshToonMaterial {...axleToon} />
        </mesh>
      </group>
      <group ref={gear2Ref} position={[0.2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.14, 0.14, 0.06, 10]} />
          <meshToonMaterial {...gearToon} />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(angle) * 0.16, Math.sin(angle) * 0.16, 0]}>
              <boxGeometry args={[0.05, 0.05, 0.06]} />
              <meshToonMaterial {...gearToon} />
            </mesh>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
          <meshToonMaterial {...axleToon} />
        </mesh>
      </group>
    </group>
  )
}

function ControlPanelProp({ position, rotation }: PropProps) {
  const bodyToon = useToonMaterialProps('#3A3A3A')
  const panelToon = useToonMaterialProps('#4A4A4A')
  const buttonColors = ['#44AA44', '#CC3333', '#FFAA00', '#4488CC', '#44AA44', '#CC3333']

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.8, 0.7, 0.4]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      <mesh position={[0, 0.72, 0.05]} rotation={[-0.4, 0, 0]} castShadow>
        <boxGeometry args={[0.7, 0.35, 0.04]} />
        <meshToonMaterial {...panelToon} />
      </mesh>
      {buttonColors.map((col, i) => {
        const row = Math.floor(i / 3)
        const colIdx = i % 3
        return (
          <mesh
            key={i}
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

function SatelliteDishProp({ position, rotation }: PropProps) {
  const dishToon = useToonMaterialProps('#CCCCCC')
  const armToon = useToonMaterialProps('#888888')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh rotation={[-0.5, 0, 0]} castShadow>
        <sphereGeometry args={[0.4, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial {...dishToon} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -0.15, 0.2]} rotation={[-0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
        <meshToonMaterial {...armToon} />
      </mesh>
      <mesh position={[0, 0.15, 0.25]} rotation={[-0.5, 0, 0]} castShadow>
        <coneGeometry args={[0.04, 0.08, 6]} />
        <meshToonMaterial {...armToon} />
      </mesh>
      <mesh position={[0, -0.4, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.04, 0.5, 6]} />
        <meshToonMaterial {...armToon} />
      </mesh>
    </group>
  )
}

function AntennaTowerProp({ position }: PropProps) {
  const poleToon = useToonMaterialProps('#777777')
  const ringToon = useToonMaterialProps('#999999')

  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 1.8, 8]} />
        <meshToonMaterial {...poleToon} />
      </mesh>
      {[0.5, 1.0, 1.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <torusGeometry args={[0.08 + i * 0.02, 0.01, 6, 12]} />
          <meshToonMaterial {...ringToon} />
        </mesh>
      ))}
      <mesh position={[0, 1.82, 0]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#FF3333" emissive="#FF3333" emissiveIntensity={0.6} />
      </mesh>
      <pointLight position={[0, 1.82, 0]} intensity={0.15} color="#FF3333" distance={3} />
    </group>
  )
}

function HeadsetProp({ position, rotation }: PropProps) {
  const bandToon = useToonMaterialProps('#333333')
  const earToon = useToonMaterialProps('#444444')
  const cushionToon = useToonMaterialProps('#555555')
  const micToon = useToonMaterialProps('#222222')

  return (
    <group position={[position[0], position[1] + 0.82, position[2]]} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.12, 0]}>
        <torusGeometry args={[0.1, 0.015, 8, 12, Math.PI]} />
        <meshToonMaterial {...bandToon} />
      </mesh>
      <mesh position={[-0.1, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
        <meshToonMaterial {...earToon} />
      </mesh>
      <mesh position={[-0.1, 0.02, 0.02]}>
        <cylinderGeometry args={[0.04, 0.04, 0.01, 10]} />
        <meshToonMaterial {...cushionToon} />
      </mesh>
      <mesh position={[0.1, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
        <meshToonMaterial {...earToon} />
      </mesh>
      <mesh position={[0.1, 0.02, 0.02]}>
        <cylinderGeometry args={[0.04, 0.04, 0.01, 10]} />
        <meshToonMaterial {...cushionToon} />
      </mesh>
      <mesh position={[-0.1, -0.02, 0.05]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.12, 6]} />
        <meshToonMaterial {...bandToon} />
      </mesh>
      <mesh position={[-0.1, -0.08, 0.08]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshToonMaterial {...micToon} />
      </mesh>
    </group>
  )
}

function SignalWavesProp({ position }: PropProps) {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)
  const waveFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (++waveFrameSkip.current % 2 !== 0) return
    const t = clock.getElapsedTime()
    const refs = [ring1Ref, ring2Ref, ring3Ref]
    refs.forEach((ref, i) => {
      if (ref.current) {
        const phase = (t * 0.8 + i * 0.7) % 2
        const scl = 0.5 + phase * 0.8
        ref.current.scale.set(scl, scl, scl)
        const mat = ref.current.material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 1 - phase / 2) * 0.4
      }
    })
  })

  return (
    <group position={position}>
      {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
        <mesh key={i} ref={ref} rotation={[Math.PI / 2, 0, 0]}>
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

function StatusLightsProp({ position }: PropProps) {
  const lights = [
    { color: '#44CC44', x: -0.15 },
    { color: '#CCCC44', x: 0 },
    { color: '#CC4444', x: 0.15 },
  ]
  const poleToon = useToonMaterialProps('#666666')

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.06, 0.06]} />
        <meshToonMaterial {...poleToon} />
      </mesh>
      {lights.map((l, i) => (
        <mesh key={i} position={[l.x, 0, 0.04]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

function FilingCabinetProp({ position, rotation }: PropProps) {
  const bodyToon = useToonMaterialProps('#777777')
  const drawerToon = useToonMaterialProps('#888888')
  const handleToon = useToonMaterialProps('#AAAAAA')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.45, 1.1, 0.4]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      {[0.18, 0.55, 0.92].map((y, i) => (
        <group key={i}>
          <mesh position={[0, y, 0.201]}>
            <boxGeometry args={[0.38, 0.28, 0.01]} />
            <meshToonMaterial {...drawerToon} />
          </mesh>
          <mesh position={[0, y, 0.22]}>
            <boxGeometry args={[0.12, 0.02, 0.02]} />
            <meshToonMaterial {...handleToon} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function FireExtinguisherProp({ position }: PropProps) {
  const bodyToon = useToonMaterialProps('#CC2222')
  const topToon = useToonMaterialProps('#444444')
  const baseToon = useToonMaterialProps('#333333')
  const hoseToon = useToonMaterialProps('#333333')

  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 10]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      <mesh position={[0, 0.57, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 0.06, 8]} />
        <meshToonMaterial {...topToon} />
      </mesh>
      <mesh position={[0.05, 0.58, 0]} rotation={[0, 0, -0.3]}>
        <boxGeometry args={[0.08, 0.02, 0.02]} />
        <meshToonMaterial {...topToon} />
      </mesh>
      <mesh position={[-0.06, 0.48, 0]} rotation={[0, 0, 0.5]}>
        <cylinderGeometry args={[0.012, 0.012, 0.15, 6]} />
        <meshToonMaterial {...hoseToon} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 0.02, 10]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
    </group>
  )
}

function DrawingTabletProp({ position, rotation }: PropProps) {
  const baseToon = useToonMaterialProps('#2A2A2A')
  const penToon = useToonMaterialProps('#555555')

  return (
    <group position={[position[0], position[1] + 0.78, position[2]]} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.02, 0]} castShadow>
        <boxGeometry args={[0.4, 0.03, 0.3]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      <mesh position={[0, 0.035, 0]}>
        <boxGeometry args={[0.32, 0.005, 0.22]} />
        <meshStandardMaterial color="#404850" emissive="#203040" emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0.25, 0.02, 0]} rotation={[0, 0.3, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.005, 0.18, 6]} />
        <meshToonMaterial {...penToon} />
      </mesh>
    </group>
  )
}

// ─── Composite Props (desk + monitor combos) ───────────────────

/** Desk with a single monitor on top */
function DeskWithMonitorProp({ position, rotation, cellSize, span }: PropProps) {
  return (
    <group>
      <DeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
    </group>
  )
}

/** Desk with dual monitors on top */
function DeskWithDualMonitorsProp({ position, rotation, cellSize, span }: PropProps) {
  const offset = 0.3
  return (
    <group>
      <DeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp position={[position[0] - offset, position[1], position[2]]} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp position={[position[0] + offset, position[1], position[2]]} rotation={rotation} cellSize={cellSize} span={span} />
    </group>
  )
}

/** Standing desk with a single monitor on top */
function StandingDeskWithMonitorProp({ position, rotation, cellSize, span }: PropProps) {
  return (
    <group>
      <StandingDeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      {/* Monitor sits higher on standing desk (1.05 desk height vs 0.78 normal) */}
      <Monitor position={[position[0], position[1] + 1.05, position[2]]} rotation={degToEuler(rotation)} />
    </group>
  )
}

/** Desk with monitor and headset (for comms room) */
function DeskWithMonitorHeadsetProp({ position, rotation, cellSize, span }: PropProps) {
  return (
    <group>
      <DeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <HeadsetProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
    </group>
  )
}

/** Desk with monitor and drawing tablet (for creative room) */
function DeskWithMonitorTabletProp({ position, rotation, cellSize, span }: PropProps) {
  return (
    <group>
      <DeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <DrawingTabletProp position={[position[0] + 0.3, position[1], position[2] + 0.1]} rotation={rotation} cellSize={cellSize} span={span} />
    </group>
  )
}

// ─── Null Prop (for interaction points, doors, etc.) ────────────

function NullProp(_props: PropProps) {
  return null
}

// ─── Prop Registry (dynamic, powered by Registry<T>) ────────────
// Built-in props register through the same API that mods will use.

import { propRegistry } from '@/lib/modding/registries'

/** Register all built-in props. Called once at module load. */
function registerBuiltinProps(): void {
  const builtins: Record<string, PropEntry> = {
    // ─── Floor props (sit on room floor, geometry builds upward from yOffset) ──
    'desk':                       { component: DeskProp,                    mountType: 'floor', yOffset: 0.16 },
    'monitor':                    { component: MonitorProp,                 mountType: 'floor', yOffset: 0.16 },
    'chair':                      { component: ChairProp,                   mountType: 'floor', yOffset: 0.16 },
    'lamp':                       { component: LampProp,                    mountType: 'floor', yOffset: 0.16 },
    'plant':                      { component: PlantProp,                   mountType: 'floor', yOffset: 0.16 },
    'coffee-machine':             { component: CoffeeMachineProp,           mountType: 'floor', yOffset: 0.16 },
    'water-cooler':               { component: WaterCoolerProp,             mountType: 'floor', yOffset: 0.16 },
    'bench':                      { component: BenchProp,                   mountType: 'floor', yOffset: 0.16 },
    'server-rack':                { component: ServerRackProp,              mountType: 'floor', yOffset: 0.16 },
    'desk-lamp':                  { component: DeskLampProp,                mountType: 'floor', yOffset: 0.16 },
    'cable-mess':                 { component: CableMessProp,               mountType: 'floor', yOffset: 0.16 },
    'easel':                      { component: EaselProp,                   mountType: 'floor', yOffset: 0.16 },
    'color-palette':              { component: ColorPaletteProp,            mountType: 'floor', yOffset: 0.16 },
    'bar-chart':                  { component: BarChartProp,                mountType: 'floor', yOffset: 0.16 },
    'megaphone':                  { component: MegaphoneProp,               mountType: 'floor', yOffset: 0.16 },
    'standing-desk':              { component: StandingDeskProp,            mountType: 'floor', yOffset: 0.16 },
    'round-table':                { component: RoundTableProp,              mountType: 'floor', yOffset: 0.16 },
    'bean-bag':                   { component: BeanBagProp,                 mountType: 'floor', yOffset: 0.16 },
    'bookshelf':                  { component: BookshelfProp,               mountType: 'floor', yOffset: 0.16 },
    'conveyor-belt':              { component: ConveyorBeltProp,            mountType: 'floor', yOffset: 0.16 },
    'control-panel':              { component: ControlPanelProp,            mountType: 'floor', yOffset: 0.16 },
    'antenna-tower':              { component: AntennaTowerProp,            mountType: 'floor', yOffset: 0.16 },
    'headset':                    { component: HeadsetProp,                 mountType: 'floor', yOffset: 0.16 },
    'filing-cabinet':             { component: FilingCabinetProp,           mountType: 'floor', yOffset: 0.16 },
    'fire-extinguisher':          { component: FireExtinguisherProp,        mountType: 'floor', yOffset: 0.16 },
    'drawing-tablet':             { component: DrawingTabletProp,           mountType: 'floor', yOffset: 0.16 },

    // ─── Wall props (mounted on walls; yOffset = mount height from room base) ──
    'notice-board':               { component: NoticeBoardProp,             mountType: 'wall', yOffset: 1.3 },
    'whiteboard':                 { component: WhiteboardProp,              mountType: 'wall', yOffset: 1.2 },
    'mood-board':                 { component: MoodBoardProp,               mountType: 'wall', yOffset: 1.2 },
    'presentation-screen':        { component: PresentationScreenProp,      mountType: 'wall', yOffset: 1.5 },
    'wall-clock':                 { component: WallClockProp,               mountType: 'wall', yOffset: 2.2 },
    'small-screen':               { component: SmallScreenProp,             mountType: 'wall', yOffset: 1.5 },
    'gear-mechanism':             { component: GearMechanismProp,           mountType: 'wall', yOffset: 1.2 },
    'satellite-dish':             { component: SatelliteDishProp,           mountType: 'wall', yOffset: 2.0 },
    'signal-waves':               { component: SignalWavesProp,             mountType: 'wall', yOffset: 2.0 },
    'status-lights':              { component: StatusLightsProp,            mountType: 'wall', yOffset: 1.3 },

    // ─── Composite props (desk + accessory combos) ───────────────
    'desk-with-monitor':          { component: DeskWithMonitorProp,         mountType: 'floor', yOffset: 0.16 },
    'desk-with-dual-monitors':    { component: DeskWithDualMonitorsProp,    mountType: 'floor', yOffset: 0.16 },
    'standing-desk-with-monitor': { component: StandingDeskWithMonitorProp, mountType: 'floor', yOffset: 0.16 },
    'desk-with-monitor-headset':  { component: DeskWithMonitorHeadsetProp,  mountType: 'floor', yOffset: 0.16 },
    'desk-with-monitor-tablet':   { component: DeskWithMonitorTabletProp,   mountType: 'floor', yOffset: 0.16 },

    // ─── Interaction-only (no visual) ────────────────────────────
    'work-point':                 { component: NullProp,                    mountType: 'floor', yOffset: 0 },
    'work-point-1':               { component: NullProp,                    mountType: 'floor', yOffset: 0 },
    'work-point-2':               { component: NullProp,                    mountType: 'floor', yOffset: 0 },
    'coffee-point':               { component: NullProp,                    mountType: 'floor', yOffset: 0 },
    'sleep-corner':               { component: NullProp,                    mountType: 'floor', yOffset: 0 },
  }

  for (const [id, entry] of Object.entries(builtins)) {
    propRegistry.register(id, entry, 'builtin')
  }
}

// Self-register all built-in props on module load
registerBuiltinProps()

// ─── Public API (delegates to propRegistry) ─────────────────────

/**
 * Get the prop component for a given propId.
 * Returns null if not found (unknown props are silently skipped).
 */
export function getPropComponent(propId: string): React.FC<PropProps> | null {
  return propRegistry.get(propId)?.component ?? null
}

/**
 * Get the full prop entry (component + mount metadata) for a given propId.
 * Returns null if not found.
 */
export function getPropEntry(propId: string): PropEntry | null {
  return propRegistry.get(propId)
}

/**
 * Get the Y offset for a given propId.
 * Floor props default to 0.16 (floor surface); wall props default to 1.2.
 */
export function getPropYOffset(propId: string): number {
  const entry = propRegistry.get(propId)
  if (!entry) return 0.16 // default: floor surface
  return entry.yOffset
}

/**
 * Get the mount type for a given propId.
 * Returns 'floor' as default for unknown props.
 */
export function getPropMountType(propId: string): MountType {
  return propRegistry.get(propId)?.mountType ?? 'floor'
}

/**
 * Get all registered prop IDs.
 * Useful for editor prop palettes and debugging.
 */
export function getAllPropIds(): string[] {
  return propRegistry.list().map((e) => e.id)
}

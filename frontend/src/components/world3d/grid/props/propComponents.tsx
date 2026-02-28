/* eslint-disable react-refresh/only-export-components */
// ─── Prop Components ────────────────────────────────────────────
// React component definitions for all built-in props.
// Wraps existing /props/ components and defines inline mini-props.

import * as THREE from 'three'
import { getToonMaterialProps, WARM_COLORS } from '../../utils/toonMaterials'
import { Desk } from '../../props/Desk'
import { Monitor } from '../../props/Monitor'
import { Chair } from '../../props/Chair'
import { Lamp } from '../../props/Lamp'
import { Plant } from '../../props/Plant'
import { CoffeeMachine } from '../../props/CoffeeMachine'
import { WaterCooler } from '../../props/WaterCooler'
import { NoticeBoard } from '../../props/NoticeBoard'
import { Bench } from '../../props/Bench'
import type { PropProps } from './PropRegistry'

/** Convert degree rotation to [0, radians, 0] euler */
export function degToEuler(deg: number): [number, number, number] {
  return [0, (deg * Math.PI) / 180, 0]
}

// ─── Wrapper Components ─────────────────────────────────────────

export function DeskProp({ position, rotation }: PropProps) {
  return <Desk position={position} rotation={degToEuler(rotation)} />
}

export function MonitorProp({ position, rotation }: PropProps) {
  return (
    <Monitor
      position={[position[0], position[1] + 0.78, position[2]]}
      rotation={degToEuler(rotation)}
    />
  )
}

export function ChairProp({ position, rotation }: PropProps) {
  return <Chair position={position} rotation={degToEuler(rotation)} />
}

export function LampProp({ position }: PropProps) {
  return <Lamp position={position} lightColor="#FFD700" lightIntensity={0.4} />
}

export function PlantProp({ position }: PropProps) {
  return <Plant position={position} scale={1} />
}

export function CoffeeMachineProp({ position, rotation }: PropProps) {
  return <CoffeeMachine position={position} rotation={degToEuler(rotation)} />
}

export function WaterCoolerProp({ position, rotation }: PropProps) {
  return <WaterCooler position={position} rotation={degToEuler(rotation)} />
}

export function NoticeBoardProp({ position, rotation }: PropProps) {
  return <NoticeBoard position={position} rotation={degToEuler(rotation)} />
}

export function BenchProp({ position, rotation }: PropProps) {
  return <Bench position={position} rotation={degToEuler(rotation)} />
}

// ─── Mini-Prop Components ───────────────────────────────────────

export function WhiteboardProp({ position, rotation }: PropProps) {
  const frameToon = getToonMaterialProps('#888888')
  const boardToon = getToonMaterialProps('#F5F5F5')
  const trayToon = getToonMaterialProps('#666666')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh castShadow>
        <boxGeometry args={[1.6, 1, 0.05]} />
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

export function ServerRackProp({ position, rotation }: PropProps) {
  const bodyToon = getToonMaterialProps('#2A2A2A')
  const rackToon = getToonMaterialProps('#1A1A1A')
  const slotToon = getToonMaterialProps('#333333')

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
      {[0.3, 0.6, 0.9, 1.2, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0.26]}>
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

// ServerLED is in propAnimations.tsx (uses useFrame), re-exported for use here
import { ServerLED } from './propAnimations'

export function DeskLampProp({ position, rotation }: PropProps) {
  const baseToon = getToonMaterialProps('#444444')
  const armToon = getToonMaterialProps('#555555')
  const shadeToon = getToonMaterialProps('#888888')

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

export function CableMessProp({ position }: PropProps) {
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
      {cables.map((c) => (
        <mesh key={String(c.pos)} position={c.pos} rotation={c.rot}>
          <cylinderGeometry args={[0.012, 0.012, c.len, 6]} />
          <meshToonMaterial {...c.toon} />
        </mesh>
      ))}
    </group>
  )
}

export function EaselProp({ position, rotation }: PropProps) {
  const woodToon = getToonMaterialProps(WARM_COLORS.wood)
  const canvasToon = getToonMaterialProps('#FFFFF0')
  const paint1 = getToonMaterialProps('#FF6B6B')
  const paint2 = getToonMaterialProps('#4ECDC4')
  const paint3 = getToonMaterialProps('#FFE66D')

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
        <boxGeometry args={[0.04, 1, 0.04]} />
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
      <mesh position={[0, 0.75, 0.06]}>
        <sphereGeometry args={[0.04, 6, 6]} />
        <meshToonMaterial {...paint3} />
      </mesh>
    </group>
  )
}

export function ColorPaletteProp({ position, rotation }: PropProps) {
  const baseToon = getToonMaterialProps(WARM_COLORS.woodLight)
  const stoolToon = getToonMaterialProps(WARM_COLORS.wood)
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#34D399', '#F97316', '#FFFFFF']

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.4, 8]} />
        <meshToonMaterial {...stoolToon} />
      </mesh>
      <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <circleGeometry args={[0.15, 16]} />
        <meshToonMaterial {...baseToon} side={THREE.DoubleSide} />
      </mesh>
      {colors.map((col, i) => {
        const angle = (i / colors.length) * Math.PI * 2
        const r = 0.08
        return (
          <mesh key={col} position={[Math.cos(angle) * r, 0.42, Math.sin(angle) * r]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshToonMaterial {...getToonMaterialProps(col)} />
          </mesh>
        )
      })}
    </group>
  )
}

export function MoodBoardProp({ position, rotation }: PropProps) {
  const frameToon = getToonMaterialProps('#555555')
  const boardToon = getToonMaterialProps('#333333')
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
          <mesh key={col} position={[-0.35 + col2 * 0.35, 0.12 - row * 0.3, 0.03]}>
            <boxGeometry args={[0.25, 0.2, 0.005]} />
            <meshToonMaterial {...getToonMaterialProps(col)} />
          </mesh>
        )
      })}
    </group>
  )
}

export function PresentationScreenProp({ position, rotation }: PropProps) {
  const frameToon = getToonMaterialProps('#333333')

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

export function BarChartProp({ position, rotation }: PropProps) {
  const baseToon = getToonMaterialProps('#555555')
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
        <mesh key={bar.color} position={[-0.28 + i * 0.14, bar.h / 2 + 0.02, 0]} castShadow>
          <boxGeometry args={[0.1, bar.h, 0.18]} />
          <meshToonMaterial {...getToonMaterialProps(bar.color)} />
        </mesh>
      ))}
    </group>
  )
}

export function MegaphoneProp({ position, rotation }: PropProps) {
  const bodyToon = getToonMaterialProps('#FF8C00')
  const bellToon = getToonMaterialProps('#FFB347')

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

export function StandingDeskProp({ position, rotation }: PropProps) {
  const topToon = getToonMaterialProps(WARM_COLORS.woodLight)
  const metalToon = getToonMaterialProps('#666666')
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

export function RoundTableProp({ position, rotation }: PropProps) {
  const topToon = getToonMaterialProps(WARM_COLORS.woodLight)
  const legToon = getToonMaterialProps(WARM_COLORS.wood)

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[1, 1, 0.06, 20]} />
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

export function BeanBagProp(props: PropProps) {
  const { position } = props
  const colors = ['#6366F1', '#8B5CF6', '#A78BFA', '#7C3AED']
  const colorIndex = Math.abs(Math.round(position[0] * 7 + position[2] * 13)) % colors.length
  const toon = getToonMaterialProps(colors[colorIndex])

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

export function BookshelfProp({ position, rotation }: PropProps) {
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
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[-0.45, 0.7, 0]} castShadow>
        <boxGeometry args={[0.04, 1.4, 0.3]} />
        <meshToonMaterial {...shelfToon} />
      </mesh>
      <mesh position={[0.45, 0.7, 0]} castShadow>
        <boxGeometry args={[0.04, 1.4, 0.3]} />
        <meshToonMaterial {...shelfToon} />
      </mesh>
      {[0.02, 0.48, 0.94, 1.4].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[0.92, 0.04, 0.3]} />
          <meshToonMaterial {...shelfToon} />
        </mesh>
      ))}
      {[0.06, 0.52, 0.98].map((shelfY, si) => (
        <group key={shelfY}>
          {bookColors.slice(si * 3, si * 3 + 3).map((col, bi) => (
            <mesh key={col} position={[-0.25 + bi * 0.22, shelfY + 0.16, 0]} castShadow>
              <boxGeometry args={[0.12, 0.28, 0.2]} />
              <meshToonMaterial {...getToonMaterialProps(col)} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export function SmallScreenProp({ position, rotation }: PropProps) {
  const frameToon = getToonMaterialProps('#2A2A2A')

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

export function ConveyorBeltProp({ position, rotation }: PropProps) {
  const beltToon = getToonMaterialProps('#444444')
  const frameToon = getToonMaterialProps('#666666')
  const boxColors = ['#FF8C00', '#4ECDC4', '#A78BFA']

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[2, 0.06, 0.4]} />
        <meshToonMaterial {...beltToon} />
      </mesh>
      <mesh position={[0, 0.2, 0.22]} castShadow>
        <boxGeometry args={[2, 0.04, 0.04]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0.2, -0.22]} castShadow>
        <boxGeometry args={[2, 0.04, 0.04]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      {[-0.85, 0, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.07, 0]} castShadow>
          <boxGeometry args={[0.06, 0.14, 0.4]} />
          <meshToonMaterial {...frameToon} />
        </mesh>
      ))}
      {boxColors.map((col, i) => (
        <mesh key={col} position={[-0.5 + i * 0.5, 0.28, 0]} castShadow>
          <boxGeometry args={[0.2, 0.18, 0.18]} />
          <meshToonMaterial {...getToonMaterialProps(col)} />
        </mesh>
      ))}
    </group>
  )
}

export function ControlPanelProp({ position, rotation }: PropProps) {
  const bodyToon = getToonMaterialProps('#3A3A3A')
  const panelToon = getToonMaterialProps('#4A4A4A')
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
            key={col}
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

export function SatelliteDishProp({ position, rotation }: PropProps) {
  const dishToon = getToonMaterialProps('#CCCCCC')
  const armToon = getToonMaterialProps('#888888')

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

export function AntennaTowerProp({ position }: PropProps) {
  const poleToon = getToonMaterialProps('#777777')
  const ringToon = getToonMaterialProps('#999999')

  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.05, 1.8, 8]} />
        <meshToonMaterial {...poleToon} />
      </mesh>
      {[0.5, 1, 1.4].map((y, i) => (
        <mesh key={y} position={[0, y, 0]}>
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

export function HeadsetProp({ position, rotation }: PropProps) {
  const bandToon = getToonMaterialProps('#333333')
  const earToon = getToonMaterialProps('#444444')
  const cushionToon = getToonMaterialProps('#555555')
  const micToon = getToonMaterialProps('#222222')

  return (
    <group
      position={[position[0], position[1] + 0.82, position[2]]}
      rotation={degToEuler(rotation)}
    >
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

export function FilingCabinetProp({ position, rotation }: PropProps) {
  const bodyToon = getToonMaterialProps('#777777')
  const drawerToon = getToonMaterialProps('#888888')
  const handleToon = getToonMaterialProps('#AAAAAA')

  return (
    <group position={position} rotation={degToEuler(rotation)}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.45, 1.1, 0.4]} />
        <meshToonMaterial {...bodyToon} />
      </mesh>
      {[0.18, 0.55, 0.92].map((y) => (
        <group key={y}>
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

export function FireExtinguisherProp({ position }: PropProps) {
  const bodyToon = getToonMaterialProps('#CC2222')
  const topToon = getToonMaterialProps('#444444')
  const baseToon = getToonMaterialProps('#333333')
  const hoseToon = getToonMaterialProps('#333333')

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

export function DrawingTabletProp({ position, rotation }: PropProps) {
  const baseToon = getToonMaterialProps('#2A2A2A')
  const penToon = getToonMaterialProps('#555555')

  return (
    <group
      position={[position[0], position[1] + 0.78, position[2]]}
      rotation={degToEuler(rotation)}
    >
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

export function StatusLightsProp({ position }: PropProps) {
  const lights = [
    { color: '#44CC44', x: -0.15 },
    { color: '#CCCC44', x: 0 },
    { color: '#CC4444', x: 0.15 },
  ]
  const poleToon = getToonMaterialProps('#666666')

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.06, 0.06]} />
        <meshToonMaterial {...poleToon} />
      </mesh>
      {lights.map((l) => (
        <mesh key={l.x} position={[l.x, 0, 0.04]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color={l.color} emissive={l.color} emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Composite Props ────────────────────────────────────────────

export function DeskWithMonitorProp({ position, rotation, cellSize, span }: PropProps) {
  return (
    <group>
      <DeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
    </group>
  )
}

export function DeskWithDualMonitorsProp({ position, rotation, cellSize, span }: PropProps) {
  const offset = 0.3
  return (
    <group>
      <DeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp
        position={[position[0] - offset, position[1], position[2]]}
        rotation={rotation}
        cellSize={cellSize}
        span={span}
      />
      <MonitorProp
        position={[position[0] + offset, position[1], position[2]]}
        rotation={rotation}
        cellSize={cellSize}
        span={span}
      />
    </group>
  )
}

export function StandingDeskWithMonitorProp({ position, rotation, cellSize, span }: PropProps) {
  return (
    <group>
      <StandingDeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <Monitor
        position={[position[0], position[1] + 1.05, position[2]]}
        rotation={degToEuler(rotation)}
      />
    </group>
  )
}

export function DeskWithMonitorHeadsetProp({ position, rotation, cellSize, span }: PropProps) {
  return (
    <group>
      <DeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <HeadsetProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
    </group>
  )
}

export function DeskWithMonitorTabletProp({ position, rotation, cellSize, span }: PropProps) {
  return (
    <group>
      <DeskProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <MonitorProp position={position} rotation={rotation} cellSize={cellSize} span={span} />
      <DrawingTabletProp
        position={[position[0] + 0.3, position[1], position[2] + 0.1]}
        rotation={rotation}
        cellSize={cellSize}
        span={span}
      />
    </group>
  )
}

// ─── Null Prop ──────────────────────────────────────────────────

export function NullProp(_props: PropProps) {
  return null
}

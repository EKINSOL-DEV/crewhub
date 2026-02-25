import { useState } from 'react'
import { Html } from '@react-three/drei'
import { useToonMaterialProps } from '../../utils/toonMaterials'
import { DynamicProp, type PropPart } from './DynamicProp'

export interface ShowcaseProp {
  propId: string
  name: string
  parts: PropPart[]
}

interface PropShowcaseProps {
  props: ShowcaseProp[]
  position?: [number, number, number]
  radius?: number
  onSelectProp?: (propId: string) => void
  onDeleteProp?: (propId: string) => void
}

function Pedestal({
  position,
  name,
  selected,
  onClick,
}: {
  position: [number, number, number]
  name: string
  selected: boolean
  onClick: () => void
}) {
  const baseToon = useToonMaterialProps('#1a1a2e')

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {/* Pedestal base */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.4, 0.3, 8]} />
        <meshToonMaterial {...baseToon} />
      </mesh>

      {/* Glow ring */}
      <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.32, 0.02, 8, 24]} />
        <meshStandardMaterial
          color={selected ? '#ffd700' : '#00ffcc'}
          emissive={selected ? '#ffd700' : '#00ffcc'}
          emissiveIntensity={selected ? 3 : 1.2}
          toneMapped={false}
        />
      </mesh>

      {/* Top surface glow */}
      <mesh position={[0, 0.305, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 24]} />
        <meshStandardMaterial
          color="#0a0a1e"
          emissive={selected ? '#ffd700' : '#00ffcc'}
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* Nameplate */}
      <Html position={[0, -0.05, 0.45]} center>
        <div
          style={{
            background: 'rgba(10, 10, 30, 0.9)',
            border: `1px solid ${selected ? 'rgba(255, 215, 0, 0.6)' : 'rgba(0, 255, 204, 0.3)'}`,
            borderRadius: '8px',
            padding: '3px 10px',
            fontSize: '11px',
            fontFamily: 'system-ui, sans-serif',
            color: selected ? '#ffd700' : '#00ffcc',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {name}
        </div>
      </Html>

      {/* Subtle point light */}
      <pointLight
        position={[0, 0.5, 0]}
        color={selected ? '#ffd700' : '#00ffcc'}
        intensity={selected ? 1.5 : 0.5}
        distance={2}
        decay={2}
      />
    </group>
  )
}

/**
 * Gallery showcase — renders generated props on pedestals in a semi-circle.
 */
export function PropShowcase({
  props,
  position = [0, 0, 0],
  radius = 3,
  onSelectProp,
  onDeleteProp: _onDeleteProp,
}: PropShowcaseProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (props.length === 0) return null

  // Place props in a semi-circle behind the machine (negative Z)
  const startAngle = Math.PI * 0.25 // start at 45 degrees
  const endAngle = Math.PI * 0.75 // end at 135 degrees
  const count = Math.min(props.length, 6)

  return (
    <group position={position}>
      {props.slice(0, 6).map((prop, i) => {
        const angle =
          count === 1
            ? (startAngle + endAngle) / 2
            : startAngle + (endAngle - startAngle) * (i / (count - 1))
        const x = Math.cos(angle) * radius
        const z = -Math.sin(angle) * radius
        const isSelected = selectedId === prop.propId

        return (
          <group key={prop.propId}>
            <Pedestal
              position={[x, 0, z]}
              name={prop.name}
              selected={isSelected}
              onClick={() => {
                setSelectedId(isSelected ? null : prop.propId)
                onSelectProp?.(prop.propId)
              }}
            />
            {/* Prop on top of pedestal */}
            <DynamicProp parts={prop.parts} position={[x, 0.32, z]} scale={0.8} />
          </group>
        )
      })}
    </group>
  )
}

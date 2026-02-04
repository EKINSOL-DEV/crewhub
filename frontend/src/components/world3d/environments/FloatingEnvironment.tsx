import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useToonMaterialProps } from '../utils/toonMaterials'

// ─── Floating Sky Platform Environment ───────────────────────────

interface FloatingEnvironmentProps {
  buildingWidth: number
  buildingDepth: number
}

/** Create a hexagonal prism geometry */
function useHexGeometry(radius: number, height: number) {
  return useMemo(() => {
    const shape = new THREE.Shape()
    const sides = 6
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 6 // rotate so flat edge faces front
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: height,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.3,
      bevelSegments: 2,
    }
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    // Rotate so it's horizontal (extrude goes along Z, we want Y)
    geo.rotateX(-Math.PI / 2)
    geo.translate(0, -height / 2, 0)
    geo.computeVertexNormals()
    return geo
  }, [radius, height])
}

/** Grid lines on the platform surface */
function PlatformGrid({ radius }: { radius: number }) {
  const lines = useMemo(() => {
    const result: { start: [number, number, number]; end: [number, number, number] }[] = []
    const spacing = 3
    const range = Math.floor(radius / spacing)

    for (let i = -range; i <= range; i++) {
      const pos = i * spacing
      // Only draw lines that are within the hexagonal bounds (approximate with circle)
      const maxExtent = Math.sqrt(radius * radius - pos * pos) * 0.9
      if (isNaN(maxExtent) || maxExtent < 1) continue
      result.push({
        start: [pos, 0.02, -maxExtent],
        end: [pos, 0.02, maxExtent],
      })
      result.push({
        start: [-maxExtent, 0.02, pos],
        end: [maxExtent, 0.02, pos],
      })
    }
    return result
  }, [radius])

  return (
    <group>
      {lines.map((line, i) => {
        const points = [
          new THREE.Vector3(...line.start),
          new THREE.Vector3(...line.end),
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        return (
          <lineSegments key={i} geometry={geometry}>
            <lineBasicMaterial color="#B0B8C0" transparent opacity={0.25} />
          </lineSegments>
        )
      })}
    </group>
  )
}

/** Glowing edge ring around the platform */
function GlowingEdge({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
      <ringGeometry args={[radius - 0.4, radius, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
    </mesh>
  )
}

/** Cloud puffs floating below the platform */
function CloudPuffs() {
  const cloudProps = useToonMaterialProps('#FFFFFF')
  const groupRef = useRef<THREE.Group>(null)

  const clouds = useMemo(() => [
    { pos: [5, -4, 3] as [number, number, number], scale: 1.8, phase: 0 },
    { pos: [-6, -5, -4] as [number, number, number], scale: 2.2, phase: 1.2 },
    { pos: [2, -6, -7] as [number, number, number], scale: 1.5, phase: 2.8 },
    { pos: [-4, -3.5, 6] as [number, number, number], scale: 1.6, phase: 4.0 },
    { pos: [7, -5.5, -2] as [number, number, number], scale: 1.3, phase: 5.5 },
  ], [])

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.children.forEach((child, i) => {
      const c = clouds[i]
      if (c) {
        child.position.y = c.pos[1] + Math.sin(t * 0.2 + c.phase) * 0.3
      }
    })
  })

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <group key={i} position={c.pos}>
          <mesh scale={c.scale}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.7} />
          </mesh>
          <mesh position={[0.8, 0.1, 0.3]} scale={c.scale * 0.7}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.6} />
          </mesh>
          <mesh position={[-0.6, -0.1, -0.4]} scale={c.scale * 0.5}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Energy beam / glow underneath the platform */
function EnergyBeam({ color }: { color: string }) {
  const beamRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!beamRef.current) return
    const t = clock.getElapsedTime()
    const mat = beamRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.08 + Math.sin(t * 0.5) * 0.04
  })

  return (
    <mesh ref={beamRef} position={[0, -6, 0]}>
      <cylinderGeometry args={[3, 1.5, 10, 8, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
    </mesh>
  )
}

export function FloatingEnvironment({ buildingWidth, buildingDepth }: FloatingEnvironmentProps) {
  const radius = Math.max(buildingWidth, buildingDepth) / 2 + 5
  const platformHeight = 1.5
  const hexGeo = useHexGeometry(radius, platformHeight)
  const platformProps = useToonMaterialProps('#C8CED4') // light gray metallic
  const accentColor = '#14b8a6' // teal accent
  const groupRef = useRef<THREE.Group>(null)

  // Subtle floating bob animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.position.y = Math.sin(t * 0.4) * 0.05
  })

  return (
    <group ref={groupRef}>
      {/* Main platform body */}
      <mesh geometry={hexGeo} castShadow receiveShadow>
        <meshToonMaterial {...platformProps} />
      </mesh>

      {/* Grid pattern on surface */}
      <PlatformGrid radius={radius} />

      {/* Glowing edge accent */}
      <GlowingEdge radius={radius} color={accentColor} />

      {/* Cloud puffs below */}
      <CloudPuffs />

      {/* Energy beam underneath */}
      <EnergyBeam color={accentColor} />
    </group>
  )
}

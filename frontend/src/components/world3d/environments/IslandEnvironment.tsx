import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useToonMaterialProps } from '../utils/toonMaterials'

// ─── Floating Island Environment (Monument Valley style) ─────────

interface IslandEnvironmentProps {
  readonly buildingWidth: number
  readonly buildingDepth: number
}

/**
 * Creates a lathe geometry for the island profile:
 * - Flat grass top (circular)
 * - Dirt/earth sides curving outward slightly
 * - Rocky bottom tapering to a point
 */
function useIslandGeometry(radius: number) {
  return useMemo(() => {
    // Profile points from top to bottom (x = radius, y = height)
    const points: THREE.Vector2[] = [
      new THREE.Vector2(0, -12), // bottom point (tapered)
      new THREE.Vector2(1.5, -10), // rocky narrow
      new THREE.Vector2(3, -8), // rock widening
      new THREE.Vector2(radius * 0.7, -5), // earth layer
      new THREE.Vector2(radius * 0.85, -3), // earth bulge
      new THREE.Vector2(radius * 0.95, -1.5), // near top
      new THREE.Vector2(radius, -0.3), // top edge (slightly below surface)
      new THREE.Vector2(radius, 0), // top surface edge
      new THREE.Vector2(0, 0), // center top
    ]
    const geo = new THREE.LatheGeometry(points, 24)
    geo.computeVertexNormals()
    return geo
  }, [radius])
}

/** Island top surface — flat circle for grass */
function IslandTop({ radius }: { radius: number }) {
  const toonProps = useToonMaterialProps('#5E8F45')
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
      <circleGeometry args={[radius, 24]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}

/** Grass tufts scattered on the island surface */
function IslandGrassTufts({ radius }: { radius: number }) {
  const toonProps = useToonMaterialProps('#4A7A35')
  const tufts = useMemo(() => {
    const result: { pos: [number, number, number]; rot: number }[] = []
    const seed = (i: number) => Math.abs(Math.sin(i * 127.1 + 311.7) * 43758.5453) % 1
    for (let i = 0; i < 18; i++) {
      const angle = seed(i) * Math.PI * 2
      const dist = seed(i + 50) * (radius - 1.5) + 0.5
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      result.push({ pos: [x, 0, z], rot: seed(i + 100) * Math.PI })
    }
    return result
  }, [radius])

  return (
    <>
      {tufts.map((t, i) => (
        <group key={`t-${i}`} position={t.pos} rotation={[0, t.rot, 0]}>
          {[-0.06, 0, 0.06].map((offset, j) => (
            <mesh key={j} position={[offset, 0.12, 0]} rotation={[0, 0, (j - 1) * 0.25]}>
              <boxGeometry args={[0.05, 0.24, 0.03]} />
              <meshToonMaterial {...toonProps} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

/** Floating debris rocks beneath the island */
function FloatingDebris() {
  const rockProps = useToonMaterialProps('#7A6B5A')
  const darkRockProps = useToonMaterialProps('#5A4D40')
  const groupRef = useRef<THREE.Group>(null)

  const debris = useMemo(
    () => [
      { pos: [4, -6, 3] as [number, number, number], scale: 0.6, phase: 0 },
      { pos: [-5, -8, -2] as [number, number, number], scale: 0.4, phase: 1.5 },
      { pos: [2, -10, -4] as [number, number, number], scale: 0.3, phase: 3 },
      { pos: [-3, -7, 5] as [number, number, number], scale: 0.5, phase: 4.5 },
      { pos: [6, -9, -1] as [number, number, number], scale: 0.35, phase: 2 },
    ],
    []
  )

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.children.forEach((child, i) => {
      const d = debris[i]
      if (d) {
        child.position.y = d.pos[1] + Math.sin(t * 0.3 + d.phase) * 0.15
        child.rotation.y = t * 0.1 + d.phase
      }
    })
  })

  return (
    <group ref={groupRef}>
      {debris.map((d, i) => (
        <mesh key={`d-${i}`} position={d.pos} scale={d.scale} castShadow>
          <dodecahedronGeometry args={[1, 0]} />
          <meshToonMaterial {...(i % 2 === 0 ? rockProps : darkRockProps)} />
        </mesh>
      ))}
    </group>
  )
}

/** Distant clouds for atmosphere */
function DistantClouds() {
  const cloudProps = useToonMaterialProps('#FFFFFF')

  const clouds = useMemo(
    () => [
      {
        pos: [35, 8, -20] as [number, number, number],
        scale: [4, 1.5, 2] as [number, number, number],
      },
      {
        pos: [-40, 12, 15] as [number, number, number],
        scale: [5, 1.2, 2.5] as [number, number, number],
      },
      {
        pos: [20, 15, 35] as [number, number, number],
        scale: [3.5, 1, 2] as [number, number, number],
      },
      {
        pos: [-25, 10, -30] as [number, number, number],
        scale: [4.5, 1.3, 2.2] as [number, number, number],
      },
    ],
    []
  )

  return (
    <>
      {clouds.map((c, i) => (
        <group key={`c-${i}`} position={c.pos}>
          <mesh scale={c.scale}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.85} />
          </mesh>
          <mesh
            position={[c.scale[0] * 0.6, -0.2, 0.3]}
            scale={[c.scale[0] * 0.5, c.scale[1] * 0.7, c.scale[2] * 0.6]}
          >
            <sphereGeometry args={[1, 8, 6]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.75} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export function IslandEnvironment({ buildingWidth, buildingDepth }: IslandEnvironmentProps) {
  // Island radius covers roughly the same area as the building + some margin
  const radius = Math.max(buildingWidth, buildingDepth) / 2 + 6
  const islandGeo = useIslandGeometry(radius)
  const earthProps = useToonMaterialProps('#8B6B4A')

  return (
    <group>
      {/* Island body (lathe shape: earth/rock) */}
      <mesh geometry={islandGeo} castShadow receiveShadow>
        <meshToonMaterial {...earthProps} side={THREE.DoubleSide} />
      </mesh>

      {/* Grass top surface */}
      <IslandTop radius={radius} />

      {/* Grass tufts on surface */}
      <IslandGrassTufts radius={radius} />

      {/* Floating debris below */}
      <FloatingDebris />

      {/* Distant clouds */}
      <DistantClouds />
    </group>
  )
}

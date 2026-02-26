import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getToonMaterialProps } from '../utils/toonMaterials'

// ─── Floating Sky Platform Environment ───────────────────────────

interface FloatingEnvironmentProps {
  readonly buildingWidth: number
  readonly buildingDepth: number
}

/** Create a hexagonal prism geometry with top surface at y = 0 in local space */
function useHexGeometry(radius: number, height: number) {
  return useMemo(() => {
    const shape = new THREE.Shape()
    const sides = 6
    for (let i = 0; i <= sides; i++) {
      const angle = (i / sides) * Math.PI * 2 - Math.PI / 6 // flat edge faces front
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      if (i === 0) shape.moveTo(x, y)
      else shape.lineTo(x, y)
    }

    const bevelThk = 0.08
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: height,
      bevelEnabled: true,
      bevelThickness: bevelThk,
      bevelSize: 0.12,
      bevelSegments: 3,
    }
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings)
    // Rotate so extrude goes along +Y (flat horizontal)
    geo.rotateX(-Math.PI / 2)
    // After rotation the back-face (top) sits at y ≈ height + bevelThk.
    // Shift down so the TOP surface is at y = 0.
    geo.translate(0, -(height + bevelThk), 0)
    geo.computeVertexNormals()
    return geo
  }, [radius, height])
}

// ─── Sci-fi panel lines on the platform surface ──────────────────

function PlatformGrid({ radius }: Readonly<{ radius: number }>) {
  const geometry = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const y = 0.005 // just above platform top

    // Concentric hexagonal rings
    const ringRadii = [radius * 0.3, radius * 0.55, radius * 0.78]
    for (const r of ringRadii) {
      for (let i = 0; i < 6; i++) {
        const a1 = (i / 6) * Math.PI * 2 - Math.PI / 6
        const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 6
        pts.push(
          new THREE.Vector3(Math.cos(a1) * r, y, Math.sin(a1) * r),
          new THREE.Vector3(Math.cos(a2) * r, y, Math.sin(a2) * r)
        )
      }
    }

    // Radial lines from center toward vertices
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 6
      const outerR = radius * 0.9
      pts.push(
        new THREE.Vector3(0, y, 0),
        new THREE.Vector3(Math.cos(a) * outerR, y, Math.sin(a) * outerR)
      )
    }

    // Mid-edge spoke lines (between hex vertices)
    for (let i = 0; i < 6; i++) {
      const a1 = (i / 6) * Math.PI * 2 - Math.PI / 6
      const a2 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 6
      const mid = (a1 + a2) / 2
      pts.push(
        new THREE.Vector3(Math.cos(mid) * radius * 0.35, y, Math.sin(mid) * radius * 0.35),
        new THREE.Vector3(Math.cos(mid) * radius * 0.82, y, Math.sin(mid) * radius * 0.82)
      )
    }

    return new THREE.BufferGeometry().setFromPoints(pts)
  }, [radius])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#9AACB8" transparent opacity={0.18} />
    </lineSegments>
  )
}

// ─── Glowing edge ring ───────────────────────────────────────────

function GlowingEdge({ radius, color }: Readonly<{ radius: number; color: string }>) {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ringRef.current) return
    const t = clock.getElapsedTime()
    const mat = ringRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.14 + Math.sin(t * 0.8) * 0.04
  })

  // 6 segments + thetaStart aligned to hex shape
  return (
    <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
      <ringGeometry args={[radius - 0.18, radius, 6, 1, -Math.PI / 6, Math.PI * 2]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ─── Emissive edge accent (chamfer glow) ─────────────────────────

function EdgeEmission({ radius, color }: Readonly<{ radius: number; color: string }>) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
      <ringGeometry args={[radius - 0.06, radius + 0.03, 6, 1, -Math.PI / 6, Math.PI * 2]} />
      <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ─── Darker-edge overlay for two-tone surface ────────────────────

function EdgeDarkening({ radius }: Readonly<{ radius: number }>) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
      <ringGeometry args={[radius * 0.65, radius, 6, 1, -Math.PI / 6, Math.PI * 2]} />
      <meshBasicMaterial color="#3E4E5C" transparent opacity={0.12} />
    </mesh>
  )
}

// ─── Cloud puffs floating below ──────────────────────────────────

function CloudPuffs() {
  const cloudProps = getToonMaterialProps('#EEF2F6')
  const groupRef = useRef<THREE.Group>(null)

  const clouds = useMemo(
    () => [
      { pos: [7, -10, 5] as [number, number, number], scale: 2.4, phase: 0 },
      { pos: [-9, -13, -6] as [number, number, number], scale: 3, phase: 1.2 },
      { pos: [3, -15, -10] as [number, number, number], scale: 2, phase: 2.8 },
      { pos: [-6, -11, 9] as [number, number, number], scale: 2.2, phase: 4 },
      { pos: [10, -14, -4] as [number, number, number], scale: 1.8, phase: 5.5 },
      { pos: [-11, -12, 3] as [number, number, number], scale: 2.6, phase: 3.2 },
    ],
    []
  )

  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    groupRef.current.children.forEach((child, i) => {
      const c = clouds[i]
      if (c) child.position.y = c.pos[1] + Math.sin(t * 0.15 + c.phase) * 0.2
    })
  })

  return (
    <group ref={groupRef}>
      {clouds.map((c, i) => (
        <group key={`c-${i}`} position={c.pos}>
          {/* Main puff */}
          <mesh scale={c.scale}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.55} />
          </mesh>
          {/* Secondary puffs for fluffiness */}
          <mesh position={[0.9, 0.15, 0.4]} scale={c.scale * 0.75}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.45} />
          </mesh>
          <mesh position={[-0.7, -0.1, -0.5]} scale={c.scale * 0.6}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.4} />
          </mesh>
          <mesh position={[0.3, 0.2, -0.8]} scale={c.scale * 0.55}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.35} />
          </mesh>
          <mesh position={[-0.4, 0.1, 0.7]} scale={c.scale * 0.5}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshToonMaterial {...cloudProps} transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// ─── Energy beam underneath ──────────────────────────────────────

function EnergyBeam({ color }: Readonly<{ color: string }>) {
  const beamRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!beamRef.current) return
    const t = clock.getElapsedTime()
    const mat = beamRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.035 + Math.sin(t * 0.4) * 0.015
  })

  return (
    <mesh ref={beamRef} position={[0, -9, 0]}>
      <cylinderGeometry args={[1.2, 0.5, 14, 6, 1, true]} />
      <meshBasicMaterial color={color} transparent opacity={0.04} side={THREE.DoubleSide} />
    </mesh>
  )
}

// ─── Main Component ──────────────────────────────────────────────

export function FloatingEnvironment({ buildingWidth, buildingDepth }: Readonly<FloatingEnvironmentProps>) {
  const radius = Math.max(buildingWidth, buildingDepth) / 2 + 5
  const platformHeight = 0.35 // sleek, thin platform
  const hexGeo = useHexGeometry(radius, platformHeight)
  const platformProps = getToonMaterialProps('#6E7F8E') // dark blue-teal gray
  const accentColor = '#14b8a6' // teal accent
  const groupRef = useRef<THREE.Group>(null)

  // Slow, very subtle floating bob (≈ 9 s period, 0.03 amplitude)
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    const t = clock.getElapsedTime()
    // Base offset -0.02 keeps platform top just below the building floor at y = 0
    groupRef.current.position.y = -0.02 + Math.sin(t * 0.698) * 0.03
  })

  return (
    <group ref={groupRef}>
      {/* Main platform body */}
      <mesh geometry={hexGeo} castShadow receiveShadow>
        <meshToonMaterial {...platformProps} />
      </mesh>

      {/* Two-tone: darker edges for depth */}
      <EdgeDarkening radius={radius} />

      {/* Sci-fi panel grid on surface */}
      <PlatformGrid radius={radius} />

      {/* Subtle teal glow ring (aligned to hex) */}
      <GlowingEdge radius={radius} color={accentColor} />

      {/* Beveled-edge emission accent */}
      <EdgeEmission radius={radius} color={accentColor} />

      {/* Fluffy cloud puffs below */}
      <CloudPuffs />

      {/* Narrow energy beam underneath */}
      <EnergyBeam color={accentColor} />
    </group>
  )
}

import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useToonMaterialProps } from '../utils/toonMaterials'

// ─── Deterministic pseudo-random ─────────────────────────────────

const seed = (x: number, z: number) =>
  Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1

// ─── Saguaro Cactus (tall with arms) ────────────────────────────

function SaguaroCactus({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const bodyProps = useToonMaterialProps('#3B7A3B')
  const darkProps = useToonMaterialProps('#2D5E2D')

  return (
    <group position={position} scale={scale}>
      {/* Main trunk */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 2.4, 8]} />
        <meshToonMaterial {...bodyProps} />
      </mesh>
      {/* Trunk cap */}
      <mesh position={[0, 2.4, 0]}>
        <sphereGeometry args={[0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshToonMaterial {...bodyProps} />
      </mesh>

      {/* Left arm */}
      <group position={[-0.18, 1.4, 0]}>
        {/* Horizontal part */}
        <mesh position={[-0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.12, 0.12, 0.5, 8]} />
          <meshToonMaterial {...darkProps} />
        </mesh>
        {/* Vertical part */}
        <mesh position={[-0.5, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.12, 0.9, 8]} />
          <meshToonMaterial {...darkProps} />
        </mesh>
        {/* Arm cap */}
        <mesh position={[-0.5, 0.9, 0]}>
          <sphereGeometry args={[0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshToonMaterial {...darkProps} />
        </mesh>
      </group>

      {/* Right arm (higher) */}
      <group position={[0.18, 1.8, 0]}>
        <mesh position={[0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 0.4, 8]} />
          <meshToonMaterial {...bodyProps} />
        </mesh>
        <mesh position={[0.4, 0.3, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.6, 8]} />
          <meshToonMaterial {...bodyProps} />
        </mesh>
        <mesh position={[0.4, 0.6, 0]}>
          <sphereGeometry args={[0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshToonMaterial {...bodyProps} />
        </mesh>
      </group>
    </group>
  )
}

// ─── Barrel Cactus (small round) ─────────────────────────────────

function BarrelCactus({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const bodyProps = useToonMaterialProps('#4A8A3A')
  const topProps = useToonMaterialProps('#C45C8A') // pinkish flower on top

  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <sphereGeometry args={[0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        <meshToonMaterial {...bodyProps} />
      </mesh>
      {/* Little flower on top */}
      <mesh position={[0, 0.48, 0]}>
        <sphereGeometry args={[0.08, 6, 4]} />
        <meshToonMaterial {...topProps} />
      </mesh>
    </group>
  )
}

// ─── Prickly Pear Cactus (flat paddle segments) ──────────────────

function PricklyCactus({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const padProps = useToonMaterialProps('#5A9A4A')
  const darkPadProps = useToonMaterialProps('#4A8A3A')

  return (
    <group position={position} scale={scale}>
      {/* Base pad */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.35, 0.5, 0.12]} />
        <meshToonMaterial {...padProps} />
      </mesh>
      {/* Left upper pad */}
      <mesh position={[-0.15, 0.75, 0]} rotation={[0, 0, 0.2]} castShadow>
        <boxGeometry args={[0.28, 0.38, 0.1]} />
        <meshToonMaterial {...darkPadProps} />
      </mesh>
      {/* Right upper pad */}
      <mesh position={[0.18, 0.82, 0]} rotation={[0, 0, -0.15]} castShadow>
        <boxGeometry args={[0.25, 0.32, 0.1]} />
        <meshToonMaterial {...padProps} />
      </mesh>
    </group>
  )
}

// ─── Desert Rock ─────────────────────────────────────────────────

function DesertRock({ position, scale = 1, variant = 0 }: {
  position: [number, number, number]
  scale?: number
  variant?: number
}) {
  const colors = ['#A0785A', '#8B6B4A', '#B8956E', '#7A5C40']
  const toonProps = useToonMaterialProps(colors[variant % colors.length])

  return (
    <mesh position={position} scale={scale} castShadow rotation={[0, variant * 1.3, 0]}>
      <dodecahedronGeometry args={[0.3, 0]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}

// ─── Tumbleweed ──────────────────────────────────────────────────

function Tumbleweed({ position, phase }: { position: [number, number, number]; phase: number }) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.x = t * 0.5 + phase
    ref.current.rotation.z = t * 0.3 + phase * 0.7
    // Gentle drift
    ref.current.position.x = position[0] + Math.sin(t * 0.1 + phase) * 0.3
    ref.current.position.z = position[2] + Math.cos(t * 0.08 + phase) * 0.2
  })

  return (
    <mesh ref={ref} position={position}>
      <icosahedronGeometry args={[0.25, 0]} />
      <meshToonMaterial color="#8B7355" wireframe transparent opacity={0.7} />
    </mesh>
  )
}

// ─── Sand Dune (subtle hill) ─────────────────────────────────────

function SandDune({ position, scaleXZ, height }: {
  position: [number, number, number]
  scaleXZ: number
  height: number
}) {
  const duneProps = useToonMaterialProps('#D4B483')

  return (
    <mesh position={position} scale={[scaleXZ, height, scaleXZ * 0.7]} receiveShadow>
      <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshToonMaterial {...duneProps} />
    </mesh>
  )
}

// ─── Desert Environment ──────────────────────────────────────────

interface DesertEnvironmentProps {
  buildingWidth: number
  buildingDepth: number
}

export function DesertEnvironment({ buildingWidth, buildingDepth }: DesertEnvironmentProps) {
  const tileSize = 4
  const gridRange = 20
  const halfBW = buildingWidth / 2 + 0.5
  const halfBD = buildingDepth / 2 + 0.5
  const sandToonProps = useToonMaterialProps('#D2B48C')
  const instanceRef = useRef<THREE.InstancedMesh>(null)

  // ── Ground tiles (instanced) ───────────────────────────────────

  const { count, matrices, colors, decorations, dunes, tumbleweeds } = useMemo(() => {
    const mList: THREE.Matrix4[] = []
    const cList: THREE.Color[] = []
    const d: {
      type: 'saguaro' | 'barrel' | 'prickly' | 'rock'
      pos: [number, number, number]
      scale?: number
      variant?: number
    }[] = []
    const duneList: { pos: [number, number, number]; scaleXZ: number; height: number }[] = []
    const twList: { pos: [number, number, number]; phase: number }[] = []

    const mat4 = new THREE.Matrix4()
    const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)

    for (let gx = -gridRange; gx <= gridRange; gx++) {
      for (let gz = -gridRange; gz <= gridRange; gz++) {
        const wx = gx * tileSize
        const wz = gz * tileSize
        if (Math.abs(wx) < halfBW && Math.abs(wz) < halfBD) continue
        const s = seed(gx, gz)

        const thickness = 0.08 + s * 0.04
        const scaleVec = new THREE.Vector3(1, 1, thickness / 0.1)
        mat4.compose(new THREE.Vector3(wx, -0.15, wz), quat, scaleVec)
        mList.push(mat4.clone())

        // Sandy color variations: tan → warm beige → light orange
        const r = 0.75 + s * 0.12
        const g = 0.62 + s * 0.10
        const b = 0.42 + s * 0.08
        cList.push(new THREE.Color(r, g, b))

        const dist = Math.sqrt(wx * wx + wz * wz)

        // Scatter cacti (saguaro) — sparse, further out
        if (s > 0.92 && dist > 15) {
          d.push({
            type: 'saguaro',
            pos: [wx + s * 2 - 1, -0.1, wz + (1 - s) * 2 - 1],
            scale: 0.7 + s * 0.5,
          })
        }
        // Barrel cacti — more common
        if (s > 0.82 && s <= 0.92 && dist > 10) {
          d.push({
            type: 'barrel',
            pos: [wx + s * 1.5 - 0.75, -0.1, wz - s * 1.2 + 0.6],
            scale: 0.6 + s * 0.6,
          })
        }
        // Prickly pear — medium rarity
        if (s > 0.76 && s <= 0.82 && dist > 12) {
          d.push({
            type: 'prickly',
            pos: [wx + (1 - s) * 2, -0.1, wz + s * 1.8 - 0.9],
            scale: 0.7 + s * 0.4,
          })
        }
        // Rocks — scattered everywhere
        if (s > 0.68 && s <= 0.76) {
          d.push({
            type: 'rock',
            pos: [wx + s * 2 - 1, -0.05, wz - s * 1.5 + 0.75],
            scale: 0.4 + s * 1.0,
            variant: Math.floor(s * 100) % 4,
          })
        }

        // Sand dunes — large, distant, sparse
        if (s > 0.95 && dist > 25) {
          duneList.push({
            pos: [wx, -0.15, wz],
            scaleXZ: 3 + s * 4,
            height: 0.5 + s * 1.2,
          })
        }

        // Tumbleweeds — rare
        if (s > 0.97 && dist > 12 && twList.length < 6) {
          twList.push({
            pos: [wx + s * 3, 0.15, wz - s * 2],
            phase: s * Math.PI * 4,
          })
        }
      }
    }

    return {
      count: mList.length,
      matrices: mList,
      colors: cList,
      decorations: d,
      dunes: duneList,
      tumbleweeds: twList,
    }
  }, [halfBW, halfBD])

  // ── Apply instanced mesh data ──────────────────────────────────

  useEffect(() => {
    const mesh = instanceRef.current
    if (!mesh) return
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrices[i])
      mesh.setColorAt(i, colors[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [count, matrices, colors])

  return (
    <group>
      {/* Warm desert lighting override */}
      <directionalLight
        position={[15, 20, 10]}
        intensity={1.8}
        color="#FFD4A0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={80}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <ambientLight intensity={0.5} color="#FFE8CC" />
      <hemisphereLight
        color="#87CEEB"
        groundColor="#D2A06D"
        intensity={0.4}
      />

      {/* Sand ground tiles (instanced) */}
      <instancedMesh
        ref={instanceRef}
        args={[undefined, undefined, count]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[tileSize, tileSize, 0.1]} />
        <meshToonMaterial {...sandToonProps} />
      </instancedMesh>

      {/* Sand dunes */}
      {dunes.map((dune, i) => (
        <SandDune
          key={`dune-${i}`}
          position={dune.pos}
          scaleXZ={dune.scaleXZ}
          height={dune.height}
        />
      ))}

      {/* Decorations: cacti and rocks */}
      {decorations.map((dec, i) => {
        switch (dec.type) {
          case 'saguaro':
            return <SaguaroCactus key={`d${i}`} position={dec.pos} scale={dec.scale} />
          case 'barrel':
            return <BarrelCactus key={`d${i}`} position={dec.pos} scale={dec.scale} />
          case 'prickly':
            return <PricklyCactus key={`d${i}`} position={dec.pos} scale={dec.scale} />
          case 'rock':
            return <DesertRock key={`d${i}`} position={dec.pos} scale={dec.scale} variant={dec.variant} />
          default:
            return null
        }
      })}

      {/* Tumbleweeds */}
      {tumbleweeds.map((tw, i) => (
        <Tumbleweed key={`tw-${i}`} position={tw.pos} phase={tw.phase} />
      ))}
    </group>
  )
}

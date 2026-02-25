import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useToonMaterialProps } from '../utils/toonMaterials'

// ─── Constants ───────────────────────────────────────────────────

const seedFn = (x: number, z: number) =>
  Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1

const TILE_SIZE = 8 // was 4 → bigger tiles, 75% fewer objects
const GRID_RANGE = 30 // was 60 → same coverage (30×8 = 240)
const DECORATION_MAX_DIST = 80 // cull decorations beyond this radius

// ─── Animated Tumbleweed (max 6, kept individual) ────────────────

function Tumbleweed({ position, phase }: { position: [number, number, number]; phase: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.x = t * 0.5 + phase
    ref.current.rotation.z = t * 0.3 + phase * 0.7
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

// ─── Generic instanced decoration batch ──────────────────────────

function InstancedDecoration({
  matrices,
  color,
  children,
  castShadow = true,
  receiveShadow = false,
}: {
  matrices: THREE.Matrix4[]
  color: string
  children: React.ReactNode
  castShadow?: boolean
  receiveShadow?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const toonProps = useToonMaterialProps(color)
  const count = matrices.length

  useEffect(() => {
    const mesh = ref.current
    if (!mesh || count === 0) return
    for (let i = 0; i < count; i++) {
      mesh.setMatrixAt(i, matrices[i])
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [matrices, count])

  if (count === 0) return null

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, count]}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      frustumCulled={false}
    >
      {children}
      <meshToonMaterial {...toonProps} />
    </instancedMesh>
  )
}

// ─── Desert Environment ──────────────────────────────────────────

interface DesertEnvironmentProps {
  buildingWidth: number
  buildingDepth: number
}

export function DesertEnvironment({ buildingWidth, buildingDepth }: DesertEnvironmentProps) {
  const sandToonProps = useToonMaterialProps('#D2B48C')
  const groundRef = useRef<THREE.InstancedMesh>(null)

  const data = useMemo(() => {
    const groundMatrices: THREE.Matrix4[] = []
    const groundColors: THREE.Color[] = []

    // Saguaro sub-parts (green: #3B7A3B)
    const saguaroTrunk: THREE.Matrix4[] = []
    const saguaroTrunkCap: THREE.Matrix4[] = []
    const saguaroRightHoriz: THREE.Matrix4[] = []
    const saguaroRightVert: THREE.Matrix4[] = []
    const saguaroRightCap: THREE.Matrix4[] = []
    // Saguaro sub-parts (dark green: #2D5E2D)
    const saguaroLeftHoriz: THREE.Matrix4[] = []
    const saguaroLeftVert: THREE.Matrix4[] = []
    const saguaroLeftCap: THREE.Matrix4[] = []

    // Barrel cactus
    const barrelBody: THREE.Matrix4[] = []
    const barrelFlower: THREE.Matrix4[] = []

    // Prickly pear
    const pricklyBase: THREE.Matrix4[] = []
    const pricklyLeft: THREE.Matrix4[] = []
    const pricklyRight: THREE.Matrix4[] = []

    // Rocks & dunes
    const rocks: THREE.Matrix4[] = []
    const dunes: THREE.Matrix4[] = []

    // Tumbleweeds (animated individually)
    const tumbleweeds: { pos: [number, number, number]; phase: number }[] = []

    // Reusable temporaries
    const mat4 = new THREE.Matrix4()
    const groundQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    )
    const identityQuat = new THREE.Quaternion()
    const rotZ90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
    const pricklyLeftQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.2)
    const pricklyRightQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1),
      -0.15
    )
    const tmpVec = new THREE.Vector3()
    const tmpQuat = new THREE.Quaternion()

    for (let gx = -GRID_RANGE; gx <= GRID_RANGE; gx++) {
      for (let gz = -GRID_RANGE; gz <= GRID_RANGE; gz++) {
        const wx = gx * TILE_SIZE
        const wz = gz * TILE_SIZE
        const s = seedFn(gx, gz)

        // ── Ground tile ─────────────────────────────
        const thickness = 0.08 + s * 0.04
        mat4.compose(
          tmpVec.set(wx, -0.08, wz),
          groundQuat,
          new THREE.Vector3(1, 1, thickness / 0.1)
        )
        groundMatrices.push(mat4.clone())
        groundColors.push(new THREE.Color(0.75 + s * 0.12, 0.62 + s * 0.1, 0.42 + s * 0.08))

        // ── Distance + building-zone gating ─────────
        const dist = Math.sqrt(wx * wx + wz * wz)
        if (dist > DECORATION_MAX_DIST) continue
        const inBuilding =
          Math.abs(wx) < buildingWidth / 2 + 2 && Math.abs(wz) < buildingDepth / 2 + 2
        if (inBuilding) continue

        // ── Saguaro cactus (s > 0.92, dist > 15) ───
        if (s > 0.92 && dist > 15) {
          const px = wx + s * 2 - 1
          const py = -0.1
          const pz = wz + (1 - s) * 2 - 1
          const sc = 0.7 + s * 0.5
          const sv = new THREE.Vector3(sc, sc, sc)

          // Trunk
          mat4.compose(tmpVec.set(px, py + 1.2 * sc, pz), identityQuat, sv)
          saguaroTrunk.push(mat4.clone())

          // Trunk cap
          mat4.compose(tmpVec.set(px, py + 2.4 * sc, pz), identityQuat, sv)
          saguaroTrunkCap.push(mat4.clone())

          // Left arm group origin
          const lx = px - 0.18 * sc
          const ly = py + 1.4 * sc

          mat4.compose(tmpVec.set(lx - 0.25 * sc, ly, pz), rotZ90, sv)
          saguaroLeftHoriz.push(mat4.clone())

          mat4.compose(tmpVec.set(lx - 0.5 * sc, ly + 0.45 * sc, pz), identityQuat, sv)
          saguaroLeftVert.push(mat4.clone())

          mat4.compose(tmpVec.set(lx - 0.5 * sc, ly + 0.9 * sc, pz), identityQuat, sv)
          saguaroLeftCap.push(mat4.clone())

          // Right arm group origin
          const rx = px + 0.18 * sc
          const ry = py + 1.8 * sc

          mat4.compose(tmpVec.set(rx + 0.2 * sc, ry, pz), rotZ90, sv)
          saguaroRightHoriz.push(mat4.clone())

          mat4.compose(tmpVec.set(rx + 0.4 * sc, ry + 0.3 * sc, pz), identityQuat, sv)
          saguaroRightVert.push(mat4.clone())

          mat4.compose(tmpVec.set(rx + 0.4 * sc, ry + 0.6 * sc, pz), identityQuat, sv)
          saguaroRightCap.push(mat4.clone())
        }

        // ── Barrel cactus (0.82 < s ≤ 0.92, dist > 10)
        if (s > 0.82 && s <= 0.92 && dist > 10) {
          const px = wx + s * 1.5 - 0.75
          const py = -0.1
          const pz = wz - s * 1.2 + 0.6
          const sc = 0.6 + s * 0.6
          const sv = new THREE.Vector3(sc, sc, sc)

          mat4.compose(tmpVec.set(px, py + 0.22 * sc, pz), identityQuat, sv)
          barrelBody.push(mat4.clone())

          mat4.compose(tmpVec.set(px, py + 0.48 * sc, pz), identityQuat, sv)
          barrelFlower.push(mat4.clone())
        }

        // ── Prickly pear (0.76 < s ≤ 0.82, dist > 12)
        if (s > 0.76 && s <= 0.82 && dist > 12) {
          const px = wx + (1 - s) * 2
          const py = -0.1
          const pz = wz + s * 1.8 - 0.9
          const sc = 0.7 + s * 0.4
          const sv = new THREE.Vector3(sc, sc, sc)

          mat4.compose(tmpVec.set(px, py + 0.35 * sc, pz), identityQuat, sv)
          pricklyBase.push(mat4.clone())

          mat4.compose(tmpVec.set(px - 0.15 * sc, py + 0.75 * sc, pz), pricklyLeftQuat, sv)
          pricklyLeft.push(mat4.clone())

          mat4.compose(tmpVec.set(px + 0.18 * sc, py + 0.82 * sc, pz), pricklyRightQuat, sv)
          pricklyRight.push(mat4.clone())
        }

        // ── Rocks (0.68 < s ≤ 0.76) ────────────────
        if (s > 0.68 && s <= 0.76) {
          const sc = 0.4 + s * 1.0
          const variant = Math.floor(s * 100) % 4
          tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), variant * 1.3)
          mat4.compose(
            tmpVec.set(wx + s * 2 - 1, -0.05, wz - s * 1.5 + 0.75),
            tmpQuat,
            new THREE.Vector3(sc, sc, sc)
          )
          rocks.push(mat4.clone())
        }

        // ── Sand dunes (s > 0.95, dist > 25) ───────
        if (s > 0.95 && dist > 25) {
          const scaleXZ = 3 + s * 4
          const height = 0.5 + s * 1.2
          mat4.compose(
            tmpVec.set(wx, -0.15, wz),
            identityQuat,
            new THREE.Vector3(scaleXZ, height, scaleXZ * 0.7)
          )
          dunes.push(mat4.clone())
        }

        // ── Tumbleweeds (s > 0.97, max 6) ──────────
        if (s > 0.97 && dist > 12 && tumbleweeds.length < 6) {
          tumbleweeds.push({
            pos: [wx + s * 3, 0.15, wz - s * 2],
            phase: s * Math.PI * 4,
          })
        }
      }
    }

    return {
      groundCount: groundMatrices.length,
      groundMatrices,
      groundColors,
      saguaroTrunk,
      saguaroTrunkCap,
      saguaroLeftHoriz,
      saguaroLeftVert,
      saguaroLeftCap,
      saguaroRightHoriz,
      saguaroRightVert,
      saguaroRightCap,
      barrelBody,
      barrelFlower,
      pricklyBase,
      pricklyLeft,
      pricklyRight,
      rocks,
      dunes,
      tumbleweeds,
    }
  }, [buildingWidth, buildingDepth])

  // Apply ground instances
  useEffect(() => {
    const mesh = groundRef.current
    if (!mesh) return
    for (let i = 0; i < data.groundCount; i++) {
      mesh.setMatrixAt(i, data.groundMatrices[i])
      mesh.setColorAt(i, data.groundColors[i])
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [data])

  return (
    <group>
      {/* Warm desert lighting */}
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
      <hemisphereLight color="#87CEEB" groundColor="#D2A06D" intensity={0.4} />

      {/* Terrain group — shifted up to sit flush with building base */}
      <group position={[0, 0.08, 0]}>
        {/* Sand ground tiles (instanced) */}
        <instancedMesh
          ref={groundRef}
          args={[undefined, undefined, data.groundCount]}
          receiveShadow
          frustumCulled={false}
        >
          <boxGeometry args={[TILE_SIZE, TILE_SIZE, 0.1]} />
          <meshToonMaterial {...sandToonProps} />
        </instancedMesh>

        {/* ═══ Saguaro Cacti — green parts ═══ */}
        <InstancedDecoration matrices={data.saguaroTrunk} color="#3B7A3B">
          <cylinderGeometry args={[0.18, 0.22, 2.4, 8]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.saguaroTrunkCap} color="#3B7A3B" castShadow={false}>
          <sphereGeometry args={[0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.saguaroRightHoriz} color="#3B7A3B">
          <cylinderGeometry args={[0.1, 0.1, 0.4, 8]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.saguaroRightVert} color="#3B7A3B">
          <cylinderGeometry args={[0.09, 0.1, 0.6, 8]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.saguaroRightCap} color="#3B7A3B" castShadow={false}>
          <sphereGeometry args={[0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </InstancedDecoration>

        {/* ═══ Saguaro Cacti — dark green parts ═══ */}
        <InstancedDecoration matrices={data.saguaroLeftHoriz} color="#2D5E2D">
          <cylinderGeometry args={[0.12, 0.12, 0.5, 8]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.saguaroLeftVert} color="#2D5E2D">
          <cylinderGeometry args={[0.11, 0.12, 0.9, 8]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.saguaroLeftCap} color="#2D5E2D" castShadow={false}>
          <sphereGeometry args={[0.11, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </InstancedDecoration>

        {/* ═══ Barrel Cactus ═══ */}
        <InstancedDecoration matrices={data.barrelBody} color="#4A8A3A">
          <sphereGeometry args={[0.28, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.75]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.barrelFlower} color="#C45C8A" castShadow={false}>
          <sphereGeometry args={[0.08, 6, 4]} />
        </InstancedDecoration>

        {/* ═══ Prickly Pear ═══ */}
        <InstancedDecoration matrices={data.pricklyBase} color="#5A9A4A">
          <boxGeometry args={[0.35, 0.5, 0.12]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.pricklyLeft} color="#4A8A3A">
          <boxGeometry args={[0.28, 0.38, 0.1]} />
        </InstancedDecoration>
        <InstancedDecoration matrices={data.pricklyRight} color="#5A9A4A">
          <boxGeometry args={[0.25, 0.32, 0.1]} />
        </InstancedDecoration>

        {/* ═══ Rocks ═══ */}
        <InstancedDecoration matrices={data.rocks} color="#8B6B4A">
          <dodecahedronGeometry args={[0.3, 0]} />
        </InstancedDecoration>

        {/* ═══ Sand Dunes ═══ */}
        <InstancedDecoration matrices={data.dunes} color="#D4B483" castShadow={false} receiveShadow>
          <sphereGeometry args={[1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </InstancedDecoration>

        {/* ═══ Tumbleweeds (animated, individual — max 6) ═══ */}
        {data.tumbleweeds.map((tw, i) => (
          <Tumbleweed key={`tw-${i}`} position={tw.pos} phase={tw.phase} />
        ))}
      </group>
    </group>
  )
}

import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { getToonMaterialProps } from '../utils/toonMaterials'

// ─── Constants ───────────────────────────────────────────────────

const seedFn = (x: number, z: number) =>
  Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1

const TILE_SIZE = 8 // was 4 → bigger tiles, 75% fewer objects
const GRID_RANGE = 30 // was 60 → same coverage (30×8 = 240)
const DECORATION_MAX_DIST = 80 // cull decorations beyond this radius

// ─── Animated Tumbleweed (max 6, kept individual) ────────────────

function Tumbleweed({
  position,
  phase,
}: Readonly<{ position: [number, number, number]; readonly phase: number }>) {
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
}: Readonly<{
  readonly matrices: THREE.Matrix4[]
  readonly color: string
  readonly children: React.ReactNode
  readonly castShadow?: boolean
  readonly receiveShadow?: boolean
}>) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const toonProps = getToonMaterialProps(color)
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

type DesertMatrices = {
  groundMatrices: THREE.Matrix4[]
  groundColors: THREE.Color[]
  saguaroTrunk: THREE.Matrix4[]
  saguaroTrunkCap: THREE.Matrix4[]
  saguaroRightHoriz: THREE.Matrix4[]
  saguaroRightVert: THREE.Matrix4[]
  saguaroRightCap: THREE.Matrix4[]
  saguaroLeftHoriz: THREE.Matrix4[]
  saguaroLeftVert: THREE.Matrix4[]
  saguaroLeftCap: THREE.Matrix4[]
  barrelBody: THREE.Matrix4[]
  barrelFlower: THREE.Matrix4[]
  pricklyBase: THREE.Matrix4[]
  pricklyLeft: THREE.Matrix4[]
  pricklyRight: THREE.Matrix4[]
  rocks: THREE.Matrix4[]
  dunes: THREE.Matrix4[]
  tumbleweeds: { pos: [number, number, number]; phase: number }[]
}

type DesertTransforms = {
  mat4: THREE.Matrix4
  groundQuat: THREE.Quaternion
  identityQuat: THREE.Quaternion
  rotZ90: THREE.Quaternion
  pricklyLeftQuat: THREE.Quaternion
  pricklyRightQuat: THREE.Quaternion
  tmpVec: THREE.Vector3
  tmpQuat: THREE.Quaternion
}

function createDesertMatrices(): DesertMatrices {
  return {
    groundMatrices: [],
    groundColors: [],
    saguaroTrunk: [],
    saguaroTrunkCap: [],
    saguaroRightHoriz: [],
    saguaroRightVert: [],
    saguaroRightCap: [],
    saguaroLeftHoriz: [],
    saguaroLeftVert: [],
    saguaroLeftCap: [],
    barrelBody: [],
    barrelFlower: [],
    pricklyBase: [],
    pricklyLeft: [],
    pricklyRight: [],
    rocks: [],
    dunes: [],
    tumbleweeds: [],
  }
}

function createDesertTransforms(): DesertTransforms {
  return {
    mat4: new THREE.Matrix4(),
    groundQuat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
    identityQuat: new THREE.Quaternion(),
    rotZ90: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2),
    pricklyLeftQuat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.2),
    pricklyRightQuat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.15),
    tmpVec: new THREE.Vector3(),
    tmpQuat: new THREE.Quaternion(),
  }
}

function pushMatrix(
  target: THREE.Matrix4[],
  transforms: DesertTransforms,
  position: THREE.Vector3,
  quaternion: THREE.Quaternion,
  scale: THREE.Vector3
) {
  transforms.mat4.compose(position, quaternion, scale)
  target.push(transforms.mat4.clone())
}

function addGroundTile(
  matrices: DesertMatrices,
  transforms: DesertTransforms,
  wx: number,
  wz: number,
  seed: number
) {
  const thickness = 0.08 + seed * 0.04
  pushMatrix(
    matrices.groundMatrices,
    transforms,
    transforms.tmpVec.set(wx, -0.08, wz),
    transforms.groundQuat,
    new THREE.Vector3(1, 1, thickness / 0.1)
  )
  matrices.groundColors.push(
    new THREE.Color(0.75 + seed * 0.12, 0.62 + seed * 0.1, 0.42 + seed * 0.08)
  )
}

function isDecorationCell(
  wx: number,
  wz: number,
  buildingWidth: number,
  buildingDepth: number,
  dist: number
) {
  if (dist > DECORATION_MAX_DIST) return false
  return !(Math.abs(wx) < buildingWidth / 2 + 2 && Math.abs(wz) < buildingDepth / 2 + 2)
}

function addSaguaro(
  matrices: DesertMatrices,
  transforms: DesertTransforms,
  wx: number,
  wz: number,
  seed: number,
  dist: number
) {
  if (!(seed > 0.92 && dist > 15)) return

  const px = wx + seed * 2 - 1
  const py = -0.1
  const pz = wz + (1 - seed) * 2 - 1
  const sc = 0.7 + seed * 0.5
  const sv = new THREE.Vector3(sc, sc, sc)

  pushMatrix(
    matrices.saguaroTrunk,
    transforms,
    transforms.tmpVec.set(px, py + 1.2 * sc, pz),
    transforms.identityQuat,
    sv
  )
  pushMatrix(
    matrices.saguaroTrunkCap,
    transforms,
    transforms.tmpVec.set(px, py + 2.4 * sc, pz),
    transforms.identityQuat,
    sv
  )

  const lx = px - 0.18 * sc
  const ly = py + 1.4 * sc
  pushMatrix(
    matrices.saguaroLeftHoriz,
    transforms,
    transforms.tmpVec.set(lx - 0.25 * sc, ly, pz),
    transforms.rotZ90,
    sv
  )
  pushMatrix(
    matrices.saguaroLeftVert,
    transforms,
    transforms.tmpVec.set(lx - 0.5 * sc, ly + 0.45 * sc, pz),
    transforms.identityQuat,
    sv
  )
  pushMatrix(
    matrices.saguaroLeftCap,
    transforms,
    transforms.tmpVec.set(lx - 0.5 * sc, ly + 0.9 * sc, pz),
    transforms.identityQuat,
    sv
  )

  const rx = px + 0.18 * sc
  const ry = py + 1.8 * sc
  pushMatrix(
    matrices.saguaroRightHoriz,
    transforms,
    transforms.tmpVec.set(rx + 0.2 * sc, ry, pz),
    transforms.rotZ90,
    sv
  )
  pushMatrix(
    matrices.saguaroRightVert,
    transforms,
    transforms.tmpVec.set(rx + 0.4 * sc, ry + 0.3 * sc, pz),
    transforms.identityQuat,
    sv
  )
  pushMatrix(
    matrices.saguaroRightCap,
    transforms,
    transforms.tmpVec.set(rx + 0.4 * sc, ry + 0.6 * sc, pz),
    transforms.identityQuat,
    sv
  )
}

function addBarrel(
  matrices: DesertMatrices,
  transforms: DesertTransforms,
  wx: number,
  wz: number,
  seed: number,
  dist: number
) {
  if (!(seed > 0.82 && seed <= 0.92 && dist > 10)) return
  const px = wx + seed * 1.5 - 0.75
  const py = -0.1
  const pz = wz - seed * 1.2 + 0.6
  const sc = 0.6 + seed * 0.6
  const sv = new THREE.Vector3(sc, sc, sc)

  pushMatrix(
    matrices.barrelBody,
    transforms,
    transforms.tmpVec.set(px, py + 0.22 * sc, pz),
    transforms.identityQuat,
    sv
  )
  pushMatrix(
    matrices.barrelFlower,
    transforms,
    transforms.tmpVec.set(px, py + 0.48 * sc, pz),
    transforms.identityQuat,
    sv
  )
}

function addPricklyPear(
  matrices: DesertMatrices,
  transforms: DesertTransforms,
  wx: number,
  wz: number,
  seed: number,
  dist: number
) {
  if (!(seed > 0.76 && seed <= 0.82 && dist > 12)) return
  const px = wx + (1 - seed) * 2
  const py = -0.1
  const pz = wz + seed * 1.8 - 0.9
  const sc = 0.7 + seed * 0.4
  const sv = new THREE.Vector3(sc, sc, sc)

  pushMatrix(
    matrices.pricklyBase,
    transforms,
    transforms.tmpVec.set(px, py + 0.35 * sc, pz),
    transforms.identityQuat,
    sv
  )
  pushMatrix(
    matrices.pricklyLeft,
    transforms,
    transforms.tmpVec.set(px - 0.15 * sc, py + 0.75 * sc, pz),
    transforms.pricklyLeftQuat,
    sv
  )
  pushMatrix(
    matrices.pricklyRight,
    transforms,
    transforms.tmpVec.set(px + 0.18 * sc, py + 0.82 * sc, pz),
    transforms.pricklyRightQuat,
    sv
  )
}

function addRock(
  matrices: DesertMatrices,
  transforms: DesertTransforms,
  wx: number,
  wz: number,
  seed: number
) {
  if (!(seed > 0.68 && seed <= 0.76)) return
  const sc = 0.4 + seed
  const variant = Math.floor(seed * 100) % 4
  transforms.tmpQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), variant * 1.3)
  pushMatrix(
    matrices.rocks,
    transforms,
    transforms.tmpVec.set(wx + seed * 2 - 1, -0.05, wz - seed * 1.5 + 0.75),
    transforms.tmpQuat,
    new THREE.Vector3(sc, sc, sc)
  )
}

function addDune(
  matrices: DesertMatrices,
  transforms: DesertTransforms,
  wx: number,
  wz: number,
  seed: number,
  dist: number
) {
  if (!(seed > 0.95 && dist > 25)) return
  const scaleXZ = 3 + seed * 4
  const height = 0.5 + seed * 1.2
  pushMatrix(
    matrices.dunes,
    transforms,
    transforms.tmpVec.set(wx, -0.15, wz),
    transforms.identityQuat,
    new THREE.Vector3(scaleXZ, height, scaleXZ * 0.7)
  )
}

function addTumbleweed(
  matrices: DesertMatrices,
  wx: number,
  wz: number,
  seed: number,
  dist: number
) {
  if (!(seed > 0.97 && dist > 12 && matrices.tumbleweeds.length < 6)) return
  matrices.tumbleweeds.push({
    pos: [wx + seed * 3, 0.15, wz - seed * 2],
    phase: seed * Math.PI * 4,
  })
}

function generateDesertData(buildingWidth: number, buildingDepth: number) {
  const matrices = createDesertMatrices()
  const transforms = createDesertTransforms()

  for (let gx = -GRID_RANGE; gx <= GRID_RANGE; gx++) {
    for (let gz = -GRID_RANGE; gz <= GRID_RANGE; gz++) {
      const wx = gx * TILE_SIZE
      const wz = gz * TILE_SIZE
      const seed = seedFn(gx, gz)

      addGroundTile(matrices, transforms, wx, wz, seed)

      const dist = Math.hypot(wx, wz)
      if (!isDecorationCell(wx, wz, buildingWidth, buildingDepth, dist)) continue

      addSaguaro(matrices, transforms, wx, wz, seed, dist)
      addBarrel(matrices, transforms, wx, wz, seed, dist)
      addPricklyPear(matrices, transforms, wx, wz, seed, dist)
      addRock(matrices, transforms, wx, wz, seed)
      addDune(matrices, transforms, wx, wz, seed, dist)
      addTumbleweed(matrices, wx, wz, seed, dist)
    }
  }

  return {
    groundCount: matrices.groundMatrices.length,
    ...matrices,
  }
}

// ─── Desert Environment ──────────────────────────────────────────

interface DesertEnvironmentProps {
  readonly buildingWidth: number
  readonly buildingDepth: number
}

export function DesertEnvironment({
  buildingWidth,
  buildingDepth,
}: Readonly<DesertEnvironmentProps>) {
  const sandToonProps = getToonMaterialProps('#D2B48C')
  const groundRef = useRef<THREE.InstancedMesh>(null)
  const sunLightRef = useRef<THREE.DirectionalLight>(null)

  const data = useMemo(
    () => generateDesertData(buildingWidth, buildingDepth),
    [buildingWidth, buildingDepth]
  )

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

  // Configure shadow properties via ref to avoid unknown JSX dash-props (Sonar S6747)
  useEffect(() => {
    const light = sunLightRef.current
    if (!light) return

    light.shadow.mapSize.set(1024, 1024)
    light.shadow.camera.near = 0.1
    light.shadow.camera.far = 80
    light.shadow.camera.left = -40
    light.shadow.camera.right = 40
    light.shadow.camera.top = 40
    light.shadow.camera.bottom = -40
    light.shadow.camera.updateProjectionMatrix()
  }, [])

  return (
    <group>
      {/* Warm desert lighting */}
      <directionalLight
        ref={sunLightRef}
        position={[15, 20, 10]}
        intensity={1.8}
        color="#FFD4A0"
        castShadow
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
        {data.tumbleweeds.map((tw, _i) => (
          <Tumbleweed key={JSON.stringify(tw)} position={tw.pos} phase={tw.phase} />
        ))}
      </group>
    </group>
  )
}

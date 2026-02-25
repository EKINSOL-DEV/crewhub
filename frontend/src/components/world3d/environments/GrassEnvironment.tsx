import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useToonMaterialProps } from '../utils/toonMaterials'

// ─── Constants ───────────────────────────────────────────────────

const seedFn = (x: number, z: number) =>
  Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1

const TILE_SIZE = 8 // was 4 → bigger tiles, 75% fewer objects
const GRID_RANGE = 30 // was 60 → same coverage (30×8 = 240)
const DECORATION_MAX_DIST = 80 // cull decorations beyond this radius

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

// ─── Grass Environment (classic) ─────────────────────────────────

interface GrassEnvironmentProps {
  readonly buildingWidth: number
  readonly buildingDepth: number
}

export function GrassEnvironment({ buildingWidth, buildingDepth }: GrassEnvironmentProps) {
  const toonProps = useToonMaterialProps('#6B8F52')
  const groundRef = useRef<THREE.InstancedMesh>(null)

  const data = useMemo(() => {
    const groundMatrices: THREE.Matrix4[] = []
    const groundColors: THREE.Color[] = []
    const grassBlades: THREE.Matrix4[] = []
    const rocks: THREE.Matrix4[] = []

    const mat4 = new THREE.Matrix4()
    const groundQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    )
    const identityQuat = new THREE.Quaternion()
    const unitScale = new THREE.Vector3(1, 1, 1)
    const tmpVec = new THREE.Vector3()

    // Pre-compute blade rotation quaternions for grass tufts
    const bladeQuats = [
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -0.3),
      new THREE.Quaternion(), // identity
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.3),
    ]
    const bladeOffsets = [-0.08, 0, 0.08]

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
        groundColors.push(new THREE.Color(0.38 + s * 0.06, 0.5 + s * 0.05, 0.32 + s * 0.04))

        // ── Distance + building-zone gating ─────────
        const dist = Math.sqrt(wx * wx + wz * wz)
        if (dist > DECORATION_MAX_DIST) continue
        const inBuilding =
          Math.abs(wx) < buildingWidth / 2 + 2 && Math.abs(wz) < buildingDepth / 2 + 2
        if (inBuilding) continue

        // ── Grass tufts (3 blades per tuft) ─────────
        if (s > 0.75) {
          const px = wx + s * 1.5 - 0.75
          const py = -0.1
          const pz = wz + (1 - s) * 1.5 - 0.75
          for (let b = 0; b < 3; b++) {
            mat4.compose(tmpVec.set(px + bladeOffsets[b], py + 0.15, pz), bladeQuats[b], unitScale)
            grassBlades.push(mat4.clone())
          }
        }

        // ── Small rocks ─────────────────────────────
        if (s > 0.88) {
          const sc = 0.5 + s * 0.8
          mat4.compose(
            tmpVec.set(wx + s * 2 - 1, -0.05, wz - s * 1.5 + 0.75),
            identityQuat,
            new THREE.Vector3(sc, sc, sc)
          )
          rocks.push(mat4.clone())
        }
      }
    }

    return {
      groundCount: groundMatrices.length,
      groundMatrices,
      groundColors,
      grassBlades,
      rocks,
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

  // Shift terrain up so tile top surface sits flush with building wall base
  return (
    <group position={[0, 0.08, 0]}>
      {/* Grass ground tiles (instanced) */}
      <instancedMesh
        ref={groundRef}
        args={[undefined, undefined, data.groundCount]}
        receiveShadow
        frustumCulled={false}
      >
        <boxGeometry args={[TILE_SIZE, TILE_SIZE, 0.1]} />
        <meshToonMaterial {...toonProps} />
      </instancedMesh>

      {/* Grass blades — all tufts in a single instanced mesh */}
      <InstancedDecoration matrices={data.grassBlades} color="#5A8A3C" castShadow={false}>
        <boxGeometry args={[0.06, 0.3, 0.04]} />
      </InstancedDecoration>

      {/* Small rocks */}
      <InstancedDecoration matrices={data.rocks} color="#9E9684">
        <dodecahedronGeometry args={[0.2, 0]} />
      </InstancedDecoration>
    </group>
  )
}

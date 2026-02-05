import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useToonMaterialProps } from '../utils/toonMaterials'

// ─── Grass Tuft ──────────────────────────────────────────────────

function GrassTuft({ position }: { position: [number, number, number] }) {
  const toonProps = useToonMaterialProps('#5A8A3C')
  return (
    <group position={position}>
      {[-0.08, 0, 0.08].map((offset, i) => (
        <mesh key={i} position={[offset, 0.15, 0]} rotation={[0, 0, (i - 1) * 0.3]}>
          <boxGeometry args={[0.06, 0.3, 0.04]} />
          <meshToonMaterial {...toonProps} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Small Rock ──────────────────────────────────────────────────

function SmallRock({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const toonProps = useToonMaterialProps('#9E9684')
  return (
    <mesh position={position} scale={scale} castShadow>
      <dodecahedronGeometry args={[0.2, 0]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}

// ─── Grass Environment (classic) ─────────────────────────────────

interface GrassEnvironmentProps {
  buildingWidth: number
  buildingDepth: number
}

export function GrassEnvironment({ buildingWidth, buildingDepth }: GrassEnvironmentProps) {
  const seed = (x: number, z: number) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1
  const tileSize = 4
  const gridRange = 60
  const halfBW = buildingWidth / 2 + 0.5
  const halfBD = buildingDepth / 2 + 0.5
  const toonProps = useToonMaterialProps('#6B8F52')
  const instanceRef = useRef<THREE.InstancedMesh>(null)

  const { count, matrices, colors, decorations } = useMemo(() => {
    const mList: THREE.Matrix4[] = []
    const cList: THREE.Color[] = []
    const d: { type: 'tuft' | 'rock'; pos: [number, number, number]; scale?: number }[] = []
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
        mat4.compose(new THREE.Vector3(wx, -0.02, wz), quat, scaleVec)
        mList.push(mat4.clone())

        const r = 0.38 + s * 0.06
        const g = 0.50 + s * 0.05
        const b = 0.32 + s * 0.04
        cList.push(new THREE.Color(r, g, b))

        if (s > 0.75) d.push({ type: 'tuft', pos: [wx + s * 1.5 - 0.75, -0.1, wz + (1 - s) * 1.5 - 0.75] })
        if (s > 0.88) d.push({ type: 'rock', pos: [wx + s * 2 - 1, -0.05, wz - s * 1.5 + 0.75], scale: 0.5 + s * 0.8 })
      }
    }
    return { count: mList.length, matrices: mList, colors: cList, decorations: d }
  }, [halfBW, halfBD])

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

  // Shift terrain up so tile top surface sits flush with building wall base (y ≈ 0).
  // Tiles were at y = -0.15 with ~0.10 thickness → top was at y ≈ -0.10.
  // Offset of 0.13 puts top at y ≈ 0.03, slightly overlapping wall base to prevent seam.
  return (
    <group position={[0, 0.13, 0]}>
      <instancedMesh ref={instanceRef} args={[undefined, undefined, count]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[tileSize, tileSize, 0.1]} />
        <meshToonMaterial {...toonProps} />
      </instancedMesh>
      {decorations.map((dec, i) =>
        dec.type === 'tuft'
          ? <GrassTuft key={`d${i}`} position={dec.pos} />
          : <SmallRock key={`d${i}`} position={dec.pos} scale={dec.scale} />
      )}
    </group>
  )
}

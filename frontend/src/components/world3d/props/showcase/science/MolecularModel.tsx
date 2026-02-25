import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function MolecularModel() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.4
  })
  // Water molecule-ish arrangement expanded
  const atoms = [
    { pos: [0, 0, 0] as [number, number, number], color: '#ff4444', r: 0.12 },
    { pos: [-0.25, 0.15, 0] as [number, number, number], color: '#ffffff', r: 0.08 },
    { pos: [0.25, 0.15, 0] as [number, number, number], color: '#ffffff', r: 0.08 },
    { pos: [0, -0.3, 0.15] as [number, number, number], color: '#4488ff', r: 0.1 },
    { pos: [0, -0.3, -0.15] as [number, number, number], color: '#44ff44', r: 0.1 },
    { pos: [-0.2, -0.5, 0] as [number, number, number], color: '#ffcc44', r: 0.08 },
    { pos: [0.2, -0.5, 0] as [number, number, number], color: '#ffcc44', r: 0.08 },
  ]
  const bonds: [number, number][] = [
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
    [3, 5],
    [4, 6],
  ]
  return (
    <group ref={groupRef}>
      {/* Atoms */}
      {atoms.map((a, i) => (
        <mesh key={`a-${i}`} position={a.pos}>
          <sphereGeometry args={[a.r, 8, 8]} />
          <meshStandardMaterial color={a.color} flatShading />
        </mesh>
      ))}
      {/* Bonds */}
      {bonds.map(([a, b], i) => {
        const p1 = new THREE.Vector3(...atoms[a].pos)
        const p2 = new THREE.Vector3(...atoms[b].pos)
        const mid = p1.clone().add(p2).multiplyScalar(0.5)
        const dir = p2.clone().sub(p1)
        const len = dir.length()
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.normalize()
        )
        return (
          <mesh key={`item-${i}`} position={[mid.x, mid.y, mid.z]} quaternion={q}>
            <cylinderGeometry args={[0.02, 0.02, len, 6]} />
            <meshStandardMaterial color="#888899" />
          </mesh>
        )
      })}
    </group>
  )
}

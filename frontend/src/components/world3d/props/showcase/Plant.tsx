import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Plant() {
  const groupRef = useRef<THREE.Group>(null)
  const leavesRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (leavesRef.current) {
      leavesRef.current.rotation.y += 0.003
      leavesRef.current.children.forEach((child, i) => {
        child.position.y = child.userData.baseY + Math.sin(state.clock.elapsedTime * 1.5 + i) * 0.02
      })
    }
  })

  const leaves = [
    { angle: 0, tilt: 0.4, scale: 1, y: 0.3 },
    { angle: Math.PI * 0.4, tilt: 0.5, scale: 0.85, y: 0.35 },
    { angle: Math.PI * 0.8, tilt: 0.35, scale: 0.95, y: 0.25 },
    { angle: Math.PI * 1.2, tilt: 0.5, scale: 0.8, y: 0.38 },
    { angle: Math.PI * 1.6, tilt: 0.45, scale: 0.9, y: 0.28 },
    { angle: Math.PI * 0.2, tilt: 0.3, scale: 0.7, y: 0.45 },
    { angle: Math.PI * 1, tilt: 0.55, scale: 0.75, y: 0.42 },
  ]

  return (
    <group ref={groupRef}>
      {/* Pot */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.35, 0.25, 0.4, 6]} />
        <meshStandardMaterial color="#cc6633" flatShading />
      </mesh>
      {/* Pot rim */}
      <mesh position={[0, -0.14, 0]}>
        <cylinderGeometry args={[0.38, 0.36, 0.06, 6]} />
        <meshStandardMaterial color="#dd7744" flatShading />
      </mesh>
      {/* Soil */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.33, 0.33, 0.03, 6]} />
        <meshStandardMaterial color="#3a2a1a" />
      </mesh>
      {/* Stem */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.4, 5]} />
        <meshStandardMaterial color="#44aa44" flatShading />
      </mesh>
      {/* Leaves */}
      <group ref={leavesRef}>
        {leaves.map((leaf, i) => (
          <group
            key={`leaf-${i}`}
            position={[0, leaf.y, 0]}
            rotation={[leaf.tilt, leaf.angle, 0]}
            userData={{ baseY: leaf.y }}
          >
            {/* Leaf = flat cone */}
            <mesh scale={[leaf.scale, leaf.scale, leaf.scale]} position={[0, 0, 0.2]}>
              <coneGeometry args={[0.18, 0.4, 4]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? '#33cc55' : '#44dd66'}
                flatShading
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

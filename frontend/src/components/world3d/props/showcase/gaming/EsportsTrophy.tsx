import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function EsportsTrophy() {
  const groupRef = useRef<THREE.Group>(null)
  const starRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
    if (starRef.current) {
      const sc = 1 + Math.sin(s.clock.elapsedTime * 2) * 0.1
      starRef.current.scale.set(sc, sc, sc)
    }
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
        <meshStandardMaterial color="#aa8822" flatShading />
      </mesh>
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[0.025, 0.06, 0.12, 6]} />
        <meshStandardMaterial color="#cc9933" flatShading />
      </mesh>
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.07, 0.04, 0.08, 8]} />
        <meshStandardMaterial color="#ffcc44" flatShading />
      </mesh>
      <mesh ref={starRef} position={[0, 0.02, 0]}>
        <dodecahedronGeometry args={[0.04, 0]} />
        <meshStandardMaterial
          color="#ffdd44"
          emissive="#ffdd44"
          emissiveIntensity={1}
          flatShading
        />
      </mesh>
      {[-0.08, 0.08].map((x, i) => (
        <mesh key={i} position={[x, -0.06, 0]}>
          <torusGeometry args={[0.03, 0.008, 4, 6, Math.PI]} />
          <meshStandardMaterial color="#cc9933" flatShading />
        </mesh>
      ))}
    </group>
  )
}

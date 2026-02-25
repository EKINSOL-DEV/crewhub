import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function BluetoothSpeaker() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.22, 12]} />
        <meshStandardMaterial color="#ff4488" flatShading />
      </mesh>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.082, 0.082, 0.12, 12]} />
        <meshStandardMaterial color="#cc3366" flatShading />
      </mesh>
      <mesh position={[0, -0.02, 0.07]}>
        <boxGeometry args={[0.025, 0.025, 0.005]} />
        <meshStandardMaterial color="#ffffff" flatShading />
      </mesh>
    </group>
  )
}

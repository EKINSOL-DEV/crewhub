import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function RaspberryPi() {
  const groupRef = useRef<THREE.Group>(null)
  const ledRef = useRef<THREE.Mesh>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
    if (ledRef.current)
      (ledRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        Math.sin(s.clock.elapsedTime * 4) > 0 ? 3 : 0.3
  })
  return (
    <group ref={groupRef}>
      {/* PCB */}
      <mesh position={[0, -0.3, 0]}>
        <boxGeometry args={[0.7, 0.04, 0.5]} />
        <meshStandardMaterial color="#228833" flatShading />
      </mesh>
      {/* CPU */}
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[0.15, 0.04, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      {/* USB ports */}
      {[0, 1].map((i) => (
        <mesh key={`item-${i}`} position={[0.36, -0.24, -0.1 + i * 0.2]}>
          <boxGeometry args={[0.08, 0.08, 0.12]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>
      ))}
      {/* Ethernet */}
      <mesh position={[0.36, -0.22, 0.05]}>
        <boxGeometry args={[0.08, 0.1, 0.12]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {/* GPIO pins */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={`item-${i}`} position={[-0.25 + i * 0.04, -0.24, -0.22]}>
          <boxGeometry args={[0.015, 0.08, 0.015]} />
          <meshStandardMaterial color="#ddcc44" />
        </mesh>
      ))}
      {/* SD card slot */}
      <mesh position={[-0.32, -0.3, 0]}>
        <boxGeometry args={[0.06, 0.02, 0.1]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Power LED */}
      <mesh ref={ledRef} position={[0.25, -0.26, 0.22]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={3} />
      </mesh>
      {/* Activity LED */}
      <mesh position={[0.2, -0.26, 0.22]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

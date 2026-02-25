import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CircuitBoard() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.15
  })
  return (
    <group ref={groupRef}>
      {/* PCB */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.9, 0.03, 0.7]} />
        <meshStandardMaterial color="#116633" flatShading />
      </mesh>
      {/* Traces */}
      {[
        [-0.2, 0, 0.6],
        [0.1, 0, 0.4],
        [-0.3, 0, 0.3],
        [0.2, 0, 0.5],
      ].map(([x, _, w], i) => (
        <mesh key={i} position={[x, -0.23, -0.1 + i * 0.12]}>
          <boxGeometry args={[w, 0.005, 0.01]} />
          <meshStandardMaterial color="#ddcc44" emissive="#ddcc44" emissiveIntensity={0.5} />
        </mesh>
      ))}
      {/* IC chips */}
      {[
        [-0.15, 0],
        [0.2, 0.1],
        [-0.1, -0.2],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.22, z]}>
          <boxGeometry args={[0.12 + i * 0.03, 0.03, 0.12 + i * 0.02]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      ))}
      {/* Capacitors */}
      {[
        [0.3, -0.15],
        [-0.3, 0.15],
        [0.1, 0.25],
        [-0.25, -0.1],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.2, z]}>
          <cylinderGeometry args={[0.03, 0.03, 0.06, 6]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#2244aa' : '#111111'} />
        </mesh>
      ))}
      {/* LEDs */}
      {[
        [0.3, 0.2],
        [-0.35, -0.25],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.22, z]}>
          <sphereGeometry args={[0.02, 4, 4]} />
          <meshStandardMaterial
            color={i === 0 ? '#ff0000' : '#00ff00'}
            emissive={i === 0 ? '#ff0000' : '#00ff00'}
            emissiveIntensity={3}
          />
        </mesh>
      ))}
      {/* Resistors */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[-0.05 + i * 0.08, -0.22, -0.25]}>
          <cylinderGeometry args={[0.012, 0.012, 0.04, 4]} />
          <meshStandardMaterial color={['#aa6633', '#ff8844', '#cc4422', '#664422'][i]} />
        </mesh>
      ))}
    </group>
  )
}

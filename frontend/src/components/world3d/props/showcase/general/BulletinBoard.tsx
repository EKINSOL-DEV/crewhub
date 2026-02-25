import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function BulletinBoard() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.4) * 0.15
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.7, 0.55, 0.03]} />
        <meshStandardMaterial color="#cc9955" flatShading />
      </mesh>
      <mesh position={[0, 0.05, 0.01]}>
        <boxGeometry args={[0.75, 0.6, 0.01]} />
        <meshStandardMaterial color="#664422" flatShading />
      </mesh>
      {[
        ['#ffee44', -0.15, 0.15],
        ['#ff88aa', 0.12, 0.08],
        ['#88ccff', -0.05, -0.1],
        ['#88ff88', 0.2, -0.05],
      ].map(([c, x, y], i) => (
        <mesh
          key={`item-${i}`}
          position={[x as number, (y as number) + 0.05, 0.025]}
          rotation={[0, 0, (i - 1.5) * 0.15]}
        >
          <boxGeometry args={[0.12, 0.1, 0.002]} />
          <meshStandardMaterial color={c as string} flatShading />
        </mesh>
      ))}
      {[
        [-0.15, 0.2],
        [0.12, 0.13],
        [-0.05, -0.05],
        [0.2, 0.0],
      ].map(([x, y], i) => (
        <mesh key={`item-${i}`} position={[x, y + 0.05, 0.03]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshStandardMaterial
            color={['#ff2222', '#2222ff', '#22cc22', '#ff8800'][i]}
            flatShading
          />
        </mesh>
      ))}
    </group>
  )
}

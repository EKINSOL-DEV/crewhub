/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function FPGABoard() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = s.clock.elapsedTime * 0.3
  })
  return (
    <group ref={groupRef}>
      <mesh position={[0, -0.15, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.25]} />
        <meshStandardMaterial color="#225522" flatShading />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <boxGeometry args={[0.08, 0.02, 0.08]} />
        <meshStandardMaterial color="#222233" flatShading />
      </mesh>
      {[-0.12, -0.07, -0.02, 0.03, 0.08, 0.13].map((x) => (
        <mesh key={x} position={[x, -0.13, 0.1]}>
          <boxGeometry args={[0.02, 0.015, 0.015]} />
          <meshStandardMaterial color="#aaaacc" flatShading />
        </mesh>
      ))}
      {[
        { z: -0.08, color: '#ff4444' },
        { z: -0.05, color: '#44ff44' },
        { z: -0.02, color: '#4488ff' },
        { z: 0.01, color: '#ffcc44' },
      ].map((led) => (
        <mesh key={led.z} {...({ position: [0.1, -0.135, led.z] } as any)}>
          <sphereGeometry args={[0.005, 4, 4]} />
          <meshStandardMaterial
            color={led.color}
            {...({ emissive: led.color, emissiveIntensity: 1 } as any)}
          />
        </mesh>
      ))}
      {[-0.13, -0.106, -0.082, -0.058, -0.034, -0.01, 0.014, 0.038, 0.062, 0.086, 0.11, 0.134].map(
        (x) => (
          <mesh key={x} {...({ position: [x, -0.14, -0.11] } as any)}>
            <cylinderGeometry args={[0.003, 0.003, 0.02, 3]} />
            <meshStandardMaterial color="#ccccdd" flatShading />
          </mesh>
        )
      )}
    </group>
  )
}

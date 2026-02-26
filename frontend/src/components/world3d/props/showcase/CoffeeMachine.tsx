import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function CoffeeMachine() {
  const groupRef = useRef<THREE.Group>(null)
  const steamRef = useRef<THREE.Group>(null)

  const steamParticles = useMemo(() => {
    return Array.from({ length: 12 }, () => ({
      x: (Math.random() - 0.5) * 0.15,
      z: (Math.random() - 0.5) * 0.15,
      speed: 0.3 + Math.random() * 0.3,
      offset: Math.random() * Math.PI * 2,
    }))
  }, [])

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.4) * 0.2
    }
  })

  return (
    <group ref={groupRef}>
      {/* Machine body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.8, 1.1, 0.6]} />
        <meshStandardMaterial color="#cc3333" flatShading />
      </mesh>
      {/* Top section */}
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[0.85, 0.2, 0.65]} />
        <meshStandardMaterial color="#aa2222" flatShading />
      </mesh>
      {/* Water tank */}
      <mesh position={[0.3, 0.3, -0.2]}>
        <boxGeometry args={[0.15, 0.5, 0.15]} />
        <meshStandardMaterial color="#4488cc" transparent opacity={0.5} />
      </mesh>
      {/* Spout */}
      <mesh position={[0, -0.1, 0.25]}>
        <boxGeometry args={[0.15, 0.08, 0.15]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Cup */}
      <mesh position={[0, -0.45, 0.2]}>
        <cylinderGeometry args={[0.12, 0.1, 0.2, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      {/* Coffee in cup */}
      <mesh position={[0, -0.36, 0.2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
        <meshStandardMaterial color="#3a1a0a" />
      </mesh>
      {/* Drip tray */}
      <mesh position={[0, -0.55, 0.1]}>
        <boxGeometry args={[0.7, 0.03, 0.4]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      {/* Buttons */}
      {[0, 1, 2].map((i) => (
        <mesh key={`item-${i}`} position={[-0.2 + i * 0.15, 0.2, 0.301]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 8]} />
          <meshStandardMaterial
            color={i === 0 ? '#00ff88' : '#888888'}
            emissive={i === 0 ? '#00ff88' : '#000000'}
            emissiveIntensity={i === 0 ? 2 : 0}
          />
        </mesh>
      ))}
      {/* Steam particles */}
      <group ref={steamRef} position={[0, -0.25, 0.2]}>
        {steamParticles.map((p, i) => (
          <mesh key={JSON.stringify(p)} position={[p.x, 0.1 + i * 0.04, p.z]}>
            <sphereGeometry args={[0.015 + i * 0.003, 6, 6]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.15 - i * 0.01} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

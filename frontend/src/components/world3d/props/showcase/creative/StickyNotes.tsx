import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function StickyNotes() {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (groupRef.current) groupRef.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.35) * 0.15
  })
  const notes = [
    { pos: [-0.2, 0.15, 0.01] as [number, number, number], color: '#ffee44', rot: -0.05 },
    { pos: [0.15, 0.2, 0.02] as [number, number, number], color: '#ff88aa', rot: 0.08 },
    { pos: [-0.1, -0.15, 0.03] as [number, number, number], color: '#88ddff', rot: -0.1 },
    { pos: [0.2, -0.1, 0.04] as [number, number, number], color: '#88ff88', rot: 0.05 },
    { pos: [0, 0, 0.05] as [number, number, number], color: '#ffaa44', rot: 0.02 },
  ]
  return (
    <group ref={groupRef}>
      {/* Board */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[0.9, 0.7, 0.03]} />
        <meshStandardMaterial color="#ccaa77" flatShading />
      </mesh>
      {/* Cork texture spots */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[(Math.random() - 0.5) * 0.7, (Math.random() - 0.5) * 0.5, -0.003]}>
          <circleGeometry args={[0.03, 5]} />
          <meshStandardMaterial color="#bb9966" />
        </mesh>
      ))}
      {/* Sticky notes */}
      {notes.map((n, i) => (
        <group key={i}>
          <mesh position={n.pos} rotation={[0, 0, n.rot]}>
            <boxGeometry args={[0.22, 0.22, 0.003]} />
            <meshStandardMaterial color={n.color} flatShading />
          </mesh>
          {/* Pin */}
          <mesh position={[n.pos[0], n.pos[1] + 0.08, n.pos[2] + 0.01]}>
            <sphereGeometry args={[0.015, 4, 4]} />
            <meshStandardMaterial
              color={['#ff0000', '#0000ff', '#00ff00', '#ff8800', '#ff00ff'][i]}
            />
          </mesh>
          {/* Text lines */}
          {[0, 1].map((l) => (
            <mesh key={l} position={[n.pos[0], n.pos[1] - 0.02 + l * 0.05, n.pos[2] + 0.005]}>
              <boxGeometry args={[0.12, 0.008, 0.001]} />
              <meshStandardMaterial color="#00000033" transparent opacity={0.2} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

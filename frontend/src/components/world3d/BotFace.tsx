import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface BotFaceProps {
  status: 'active' | 'idle' | 'sleeping' | 'offline'
}

/**
 * Bot face — two sphere eyes with blinking + pupil, and a simple arc mouth.
 */
export function BotFace({ status }: BotFaceProps) {
  const leftEyeRef = useRef<THREE.Mesh>(null)
  const rightEyeRef = useRef<THREE.Mesh>(null)

  // Blinking animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Blink every ~3 seconds
    const blink = Math.sin(t * 2.1) > 0.97
    const closed = status === 'sleeping' || blink
    const sy = closed ? 0.05 : 1
    leftEyeRef.current?.scale.set(1, sy, 1)
    rightEyeRef.current?.scale.set(1, sy, 1)
  })

  return (
    <group position={[0, 0.32, 0.19]}>
      {/* Left eye - white */}
      <mesh ref={leftEyeRef} position={[-0.07, 0, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Left pupil */}
      <mesh position={[-0.07, 0, 0.03]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Right eye - white */}
      <mesh ref={rightEyeRef} position={[0.07, 0, 0]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshStandardMaterial color="white" />
      </mesh>
      {/* Right pupil */}
      <mesh position={[0.07, 0, 0.03]}>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Mouth — simple arc */}
      <group position={[0, -0.1, 0.01]} rotation={[0.2, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.04, 0.008, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      </group>
    </group>
  )
}

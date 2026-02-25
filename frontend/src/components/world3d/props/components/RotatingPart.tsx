import { useRef } from 'react'
import { useThrottledFrame } from '../../utils/useThrottledFrame'
import * as THREE from 'three'

interface RotatingPartProps {
  position?: [number, number, number]
  axis?: 'x' | 'y' | 'z'
  speed?: number
  children: React.ReactNode
}

/**
 * Generic wrapper that rotates its children around a specified axis.
 *
 * Usage:
 *   <RotatingPart speed={0.5}>
 *     <mesh><torusGeometry args={[0.3, 0.02, 8, 32]} /><meshStandardMaterial color="#gold" /></mesh>
 *   </RotatingPart>
 *
 *   <RotatingPart axis="x" speed={-0.3} position={[0, 1, 0]}>
 *     <mesh><boxGeometry args={[0.5, 0.05, 0.05]} /><meshStandardMaterial color="#cc3333" /></mesh>
 *   </RotatingPart>
 */
export function RotatingPart({
  position = [0, 0, 0],
  axis = 'y',
  speed = 1,
  children,
}: RotatingPartProps) {
  const groupRef = useRef<THREE.Group>(null)

  useThrottledFrame((_, delta) => {
    if (!groupRef.current) return
    const rate = speed * delta * 2
    switch (axis) {
      case 'x':
        groupRef.current.rotation.x += rate
        break
      case 'y':
        groupRef.current.rotation.y += rate
        break
      case 'z':
        groupRef.current.rotation.z += rate
        break
    }
  }, 2)

  return (
    <group position={position} ref={groupRef}>
      {children}
    </group>
  )
}

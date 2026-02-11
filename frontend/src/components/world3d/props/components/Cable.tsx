import { useMemo } from 'react'
import * as THREE from 'three'

interface CableProps {
  from: [number, number, number]
  to: [number, number, number]
  color?: string
  thickness?: number
  sag?: number
  segments?: number
}

/**
 * Curvy connecting cable/wire between two points using a CatmullRom curve.
 *
 * Usage:
 *   <Cable from={[-0.3, 0.5, 0]} to={[0.3, 0.5, 0]} />
 *   <Cable from={[0, 0, 0]} to={[0, 1, 0.5]} color="#ff4444" thickness={0.02} />
 *   <Cable from={[-1, 0, 0]} to={[1, 0, 0]} sag={0.4} segments={24} />
 */
export function Cable({
  from,
  to,
  color = '#333333',
  thickness = 0.015,
  sag = 0.2,
  segments = 16,
}: CableProps) {
  const geometry = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5)
    mid.y -= sag

    // Add a slight offset for more natural curve
    const q1 = new THREE.Vector3().lerpVectors(start, mid, 0.5)
    q1.y -= sag * 0.3
    const q2 = new THREE.Vector3().lerpVectors(mid, end, 0.5)
    q2.y -= sag * 0.3

    const curve = new THREE.CatmullRomCurve3([start, q1, mid, q2, end])
    return new THREE.TubeGeometry(curve, segments, thickness, 6, false)
  }, [from, to, thickness, sag, segments])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
    </mesh>
  )
}

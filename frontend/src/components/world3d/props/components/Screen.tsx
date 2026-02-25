import { useRef } from 'react'
import { useThrottledFrame } from '../../utils/useThrottledFrame'
import * as THREE from 'three'

interface ScreenProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  width?: number
  height?: number
  color?: string
  bezelColor?: string
  scanlines?: boolean
  flicker?: boolean
}

/**
 * Animated display panel with glowing screen, optional scanline effect, and flicker.
 *
 * Usage:
 *   <Screen position={[0, 0.5, 0.2]} />
 *   <Screen width={0.6} height={0.4} color="#00ff88" />
 *   <Screen color="#ff4444" scanlines flicker />
 */
export function Screen({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  width = 0.4,
  height = 0.25,
  color = '#00ff88',
  bezelColor = '#1a1a2e',
  scanlines = true,
  flicker = false,
}: ScreenProps) {
  const screenRef = useRef<THREE.MeshStandardMaterial>(null)
  const scanRef = useRef<THREE.Mesh>(null)

  useThrottledFrame((state) => {
    const t = state.clock.elapsedTime
    if (screenRef.current) {
      let intensity = 0.5 + Math.sin(t * 2) * 0.1
      if (flicker) {
        intensity *= Math.random() > 0.95 ? 0.3 : 1
      }
      screenRef.current.emissiveIntensity = intensity
    }
    if (scanRef.current) {
      // Scroll scanline overlay
      scanRef.current.position.y = (((t * 0.3) % 1) - 0.5) * height * 0.8
    }
  }, 2)

  const bezelDepth = 0.03

  return (
    <group position={position} rotation={rotation as any}>
      {/* Bezel / frame */}
      <mesh>
        <boxGeometry args={[width + 0.04, height + 0.04, bezelDepth]} />
        <meshStandardMaterial color={bezelColor} flatShading />
      </mesh>

      {/* Screen surface */}
      <mesh position={[0, 0, bezelDepth / 2 + 0.002]}>
        <boxGeometry args={[width, height, 0.005]} />
        <meshStandardMaterial
          ref={screenRef}
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Scanline overlay */}
      {scanlines && (
        <mesh ref={scanRef} position={[0, 0, bezelDepth / 2 + 0.006]}>
          <boxGeometry args={[width * 0.95, 0.01, 0.001]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.08} depthWrite={false} />
        </mesh>
      )}
    </group>
  )
}

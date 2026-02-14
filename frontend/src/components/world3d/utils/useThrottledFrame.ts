/**
 * Utilities for throttling useFrame callbacks in Three.js components.
 * Cosmetic animations (glow pulses, rotations, etc.) don't need to run
 * at full 60fps — running every 2nd or 3rd frame saves CPU.
 */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { RootState } from '@react-three/fiber'

/**
 * Like useFrame but only calls the callback every N frames.
 * Great for cosmetic animations that don't need 60fps precision.
 *
 * @param callback - Frame callback (same signature as useFrame)
 * @param every - Run every N frames (default: 2 = 30fps on a 60fps display)
 */
export function useThrottledFrame(
  callback: (state: RootState, delta: number) => void,
  every: number = 2,
) {
  const frameCount = useRef(0)

  useFrame((state, delta) => {
    frameCount.current++
    if (frameCount.current % every === 0) {
      callback(state, delta * every) // Scale delta to account for skipped frames
    }
  })
}

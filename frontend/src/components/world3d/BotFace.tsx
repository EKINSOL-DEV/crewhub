import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { BotExpression } from './utils/botVariants'

interface BotFaceProps {
  status: 'active' | 'idle' | 'sleeping' | 'offline'
  expression: BotExpression
}

/**
 * Bot face — large expressive eyes with blinking and per-type mouth expression.
 * Positioned on the HEAD (y=0.32 in body space).
 *
 * Eyes: Big white circles with dark pupils (like the 2D reference).
 * Mouth: Different shape per expression type.
 */
export function BotFace({ status, expression }: BotFaceProps) {
  const leftEyeRef = useRef<THREE.Group>(null)
  const rightEyeRef = useRef<THREE.Group>(null)

  // Blinking animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Blink every ~3.5 seconds for ~0.15s
    const blinkCycle = t % 3.5
    const isBlinking = blinkCycle > 3.3 && blinkCycle < 3.45
    const closed = status === 'sleeping' || isBlinking
    const sy = closed ? 0.08 : 1
    leftEyeRef.current?.scale.set(1, sy, 1)
    rightEyeRef.current?.scale.set(1, sy, 1)
  })

  // Eye spacing and size
  const eyeSpacing = 0.09
  const eyeY = 0.34 // Slightly above head center (head center = 0.32)
  const eyeZ = 0.155 // Front face of head

  // Pupil offset per expression
  const pupilOffset = getPupilOffset(expression)

  return (
    <group>
      {/* ─── Left eye ─── */}
      <group ref={leftEyeRef} position={[-eyeSpacing, eyeY, eyeZ]}>
        {/* White sclera */}
        <mesh>
          <circleGeometry args={[0.065, 20]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Dark pupil */}
        <mesh position={[pupilOffset.x, pupilOffset.y, 0.005]}>
          <circleGeometry args={[0.035, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Eye highlight */}
        <mesh position={[0.015 + pupilOffset.x, 0.015 + pupilOffset.y, 0.01]}>
          <circleGeometry args={[0.012, 10]} />
          <meshStandardMaterial color="white" />
        </mesh>
      </group>

      {/* ─── Right eye ─── */}
      <group ref={rightEyeRef} position={[eyeSpacing, eyeY, eyeZ]}>
        {/* White sclera */}
        <mesh>
          <circleGeometry args={[0.065, 20]} />
          <meshStandardMaterial color="white" />
        </mesh>
        {/* Dark pupil */}
        <mesh position={[pupilOffset.x, pupilOffset.y, 0.005]}>
          <circleGeometry args={[0.035, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Eye highlight */}
        <mesh position={[0.015 + pupilOffset.x, 0.015 + pupilOffset.y, 0.01]}>
          <circleGeometry args={[0.012, 10]} />
          <meshStandardMaterial color="white" />
        </mesh>
      </group>

      {/* ─── Mouth (per expression) ─── */}
      <group position={[0, 0.23, eyeZ]}>
        <ExpressionMouth expression={expression} />
      </group>
    </group>
  )
}

// ─── Pupil offset per expression ───────────────────────────────

function getPupilOffset(expression: BotExpression): { x: number; y: number } {
  switch (expression) {
    case 'happy':      return { x: 0, y: 0 }        // centered, confident
    case 'thoughtful': return { x: 0.01, y: 0.01 }   // looking up-right (thinking)
    case 'determined': return { x: 0, y: 0 }         // centered, focused
    case 'talking':    return { x: -0.005, y: 0 }    // slightly left (engaging)
    case 'serious':    return { x: 0, y: -0.005 }    // centered, slightly down
  }
}

// ─── Mouth shapes per expression ───────────────────────────────

function ExpressionMouth({ expression }: { expression: BotExpression }) {
  switch (expression) {
    case 'happy':
      // Wide happy smile — arc curving up
      return (
        <mesh rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.04, 0.01, 6, 12, Math.PI]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      )

    case 'thoughtful':
      // Small subtle smile / neutral line
      return (
        <mesh rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.025, 0.008, 6, 10, Math.PI * 0.7]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      )

    case 'determined':
      // Firm, straight-ish mouth
      return (
        <mesh>
          <boxGeometry args={[0.06, 0.012, 0.004]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      )

    case 'talking':
      // Open mouth — small circle/ellipse (like 😮)
      return (
        <mesh>
          <circleGeometry args={[0.028, 16]} />
          <meshStandardMaterial color="#e05080" />
        </mesh>
      )

    case 'serious':
      // Slight frown — arc curving down
      return (
        <mesh>
          <torusGeometry args={[0.03, 0.008, 6, 10, Math.PI]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      )
  }
}

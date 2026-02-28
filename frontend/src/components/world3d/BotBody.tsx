/* eslint-disable sonarjs/cognitive-complexity */
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { getToonMaterialProps } from './utils/toonMaterials'

interface BotBodyProps {
  readonly color: string
  readonly status: 'active' | 'idle' | 'sleeping' | 'supervising' | 'offline' | 'meeting'
  /** Mutable ref for walk animation phase; >0 when walking, 0 when stopped */
  readonly walkPhaseRef?: React.MutableRefObject<number>
}

/**
 * Darken a hex color by a factor (0 = black, 1 = original).
 */
function darkenColor(hex: string, factor: number = 0.6): string {
  const c = new THREE.Color(hex)
  c.multiplyScalar(factor)
  return '#' + c.getHexString()
}

/**
 * Bot body — two stacked rounded boxes (head + body) with arms and feet.
 * Matches the 2D reference design: distinct head sitting on top of body.
 *
 * Layout (y positions, bottom of bot at y ≈ -0.35):
 *   Head:       center y=0.32,  size [0.36, 0.32, 0.32]
 *   Body:       center y=-0.02, size [0.40, 0.28, 0.34]
 *   Lower body: center y=-0.13, size [0.40, 0.12, 0.34] (darker)
 *   Arms:       center y=0.00,  capsule on each side
 *   Feet:       center y=-0.30, small dark boxes
 */
function animateWalk( // NOSONAR: walk animation with multiple limb ref conditions
  walkPhase: number,
  leftFoot: React.RefObject<THREE.Mesh | null>,
  rightFoot: React.RefObject<THREE.Mesh | null>,
  leftArm: React.RefObject<THREE.Mesh | null>,
  rightArm: React.RefObject<THREE.Mesh | null>
): void {
  if (walkPhase > 0) {
    const sin = Math.sin(walkPhase)
    const sinOpp = Math.sin(walkPhase + Math.PI)
    if (leftFoot.current) {
      leftFoot.current.position.z = 0.03 + sin * 0.06
      leftFoot.current.position.y = -0.3 + Math.max(0, sin) * 0.04
    }
    if (rightFoot.current) {
      rightFoot.current.position.z = 0.03 + sinOpp * 0.06
      rightFoot.current.position.y = -0.3 + Math.max(0, sinOpp) * 0.04
    }
    if (leftArm.current) leftArm.current.rotation.x = sinOpp * 0.35
    if (rightArm.current) rightArm.current.rotation.x = sin * 0.35
  } else {
    if (leftFoot.current) leftFoot.current.position.set(-0.09, -0.3, 0.03)
    if (rightFoot.current) rightFoot.current.position.set(0.09, -0.3, 0.03)
    if (leftArm.current) leftArm.current.rotation.x = 0
    if (rightArm.current) rightArm.current.rotation.x = 0
  }
}

function animateBreathing(
  status: string,
  elapsed: number,
  bodyGroup: React.RefObject<THREE.Group | null>
): void {
  if (!bodyGroup.current) return
  if (status === 'sleeping') {
    const breathe = 1 + Math.sin(elapsed * 1.2) * 0.015
    bodyGroup.current.scale.set(breathe, 1, breathe)
  } else {
    bodyGroup.current.scale.set(1, 1, 1)
  }
}

export function BotBody({ color, status, walkPhaseRef }: BotBodyProps) {
  const bodyGroupRef = useRef<THREE.Group>(null)
  const leftFootRef = useRef<THREE.Mesh>(null)
  const rightFootRef = useRef<THREE.Mesh>(null)
  const leftArmRef = useRef<THREE.Mesh>(null)
  const rightArmRef = useRef<THREE.Mesh>(null)
  const toonProps = getToonMaterialProps(color)
  const darkBodyToon = getToonMaterialProps(darkenColor(color, 0.65))
  const darkToon = getToonMaterialProps('#2a2a2a')

  useFrame(({ clock }) => {
    if (!bodyGroupRef.current) return

    animateWalk(walkPhaseRef?.current ?? 0, leftFootRef, rightFootRef, leftArmRef, rightArmRef)
    animateBreathing(status, clock.getElapsedTime(), bodyGroupRef)
  })

  return (
    <group ref={bodyGroupRef}>
      {/* ─── Head (upper rounded box) ─── */}
      <RoundedBox
        args={[0.36, 0.32, 0.32]}
        radius={0.07}
        smoothness={4}
        position={[0, 0.32, 0]}
        castShadow
      >
        <meshToonMaterial {...toonProps} />
      </RoundedBox>

      {/* ─── Body (main rounded box, slightly wider) ─── */}
      <RoundedBox
        args={[0.4, 0.28, 0.34]}
        radius={0.06}
        smoothness={4}
        position={[0, -0.02, 0]}
        castShadow
      >
        <meshToonMaterial {...toonProps} />
      </RoundedBox>

      {/* ─── Lower body / base (darker shade) ─── */}
      <RoundedBox
        args={[0.4, 0.12, 0.34]}
        radius={0.04}
        smoothness={3}
        position={[0, -0.14, 0]}
        castShadow
      >
        <meshToonMaterial {...darkBodyToon} />
      </RoundedBox>

      {/* ─── Left arm (stubby capsule) ─── */}
      <mesh ref={leftArmRef} position={[-0.26, 0, 0]} rotation={[0, 0, 0.2]} castShadow>
        <capsuleGeometry args={[0.04, 0.12, 6, 8]} />
        <meshToonMaterial {...toonProps} />
      </mesh>

      {/* ─── Right arm (stubby capsule) ─── */}
      <mesh ref={rightArmRef} position={[0.26, 0, 0]} rotation={[0, 0, -0.2]} castShadow>
        <capsuleGeometry args={[0.04, 0.12, 6, 8]} />
        <meshToonMaterial {...toonProps} />
      </mesh>

      {/* ─── Left foot ─── */}
      <mesh ref={leftFootRef} position={[-0.09, -0.3, 0.03]} castShadow>
        <boxGeometry args={[0.1, 0.06, 0.13]} />
        <meshToonMaterial {...darkToon} />
      </mesh>

      {/* ─── Right foot ─── */}
      <mesh ref={rightFootRef} position={[0.09, -0.3, 0.03]} castShadow>
        <boxGeometry args={[0.1, 0.06, 0.13]} />
        <meshToonMaterial {...darkToon} />
      </mesh>
    </group>
  )
}

// ─── Animated Prop Components ───────────────────────────────────
// Props that use useFrame hooks for animation.
// Separated to keep static components tree-shakeable.

import * as THREE from 'three'
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { getToonMaterialProps } from '../../utils/toonMaterials'
import type { PropProps } from './PropRegistry'
import { degToEuler } from './propComponents'

// ─── ServerLED (used by ServerRackProp in propComponents) ───────

export function ServerLED({
  position,
  color,
}: {
  position: [number, number, number]
  color: string
}) {
  const ref = useRef<THREE.Mesh>(null)
  const blinkSpeed = useMemo(() => 2 + Math.random() * 0.5, [])
  const frameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (!ref.current) return
    if (++frameSkip.current % 3 !== 0) return
    const mat = ref.current.material as THREE.MeshStandardMaterial
    const blink = Math.sin(clock.getElapsedTime() * blinkSpeed + position[1] * 10) > 0
    mat.emissiveIntensity = blink ? 0.8 : 0.1
  })

  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.02, 6, 6]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  )
}

// ─── WallClockProp ──────────────────────────────────────────────

export function WallClockProp({ position }: PropProps) {
  const frameToon = getToonMaterialProps('#333333')
  const faceToon = getToonMaterialProps('#FFFFF0')
  const handToon = getToonMaterialProps('#222222')
  const centerToon = getToonMaterialProps('#CC3333')
  const handRef1 = useRef<THREE.Mesh>(null)
  const handRef2 = useRef<THREE.Mesh>(null)
  const clockFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (++clockFrameSkip.current % 3 !== 0) return
    const t = clock.getElapsedTime()
    if (handRef1.current) handRef1.current.rotation.z = -t * 0.5
    if (handRef2.current) handRef2.current.rotation.z = -t * 0.04
  })

  return (
    <group position={position} rotation={[Math.PI / 2, 0, Math.PI]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.06, 24]} />
        <meshToonMaterial {...frameToon} />
      </mesh>
      <mesh position={[0, 0, 0.031]}>
        <cylinderGeometry args={[0.4, 0.4, 0.005, 24]} />
        <meshToonMaterial {...faceToon} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2
        const r = 0.33
        return (
          <mesh key={`item-${i}`} position={[Math.sin(angle) * r, Math.cos(angle) * r, 0.035]}>
            <boxGeometry args={[0.02, 0.06, 0.005]} />
            <meshToonMaterial {...frameToon} />
          </mesh>
        )
      })}
      <mesh ref={handRef1} position={[0, 0, 0.04]}>
        <boxGeometry args={[0.015, 0.28, 0.005]} />
        <meshToonMaterial {...handToon} />
      </mesh>
      <mesh ref={handRef2} position={[0, 0, 0.042]}>
        <boxGeometry args={[0.02, 0.2, 0.005]} />
        <meshToonMaterial {...handToon} />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshToonMaterial {...centerToon} />
      </mesh>
    </group>
  )
}

// ─── GearMechanismProp ──────────────────────────────────────────

export function GearMechanismProp({ position, rotation }: PropProps) {
  const gearToon = getToonMaterialProps('#777777')
  const axleToon = getToonMaterialProps('#555555')
  const gear1Ref = useRef<THREE.Group>(null)
  const gear2Ref = useRef<THREE.Group>(null)
  const gearFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (++gearFrameSkip.current % 2 !== 0) return
    const t = clock.getElapsedTime()
    if (gear1Ref.current) gear1Ref.current.rotation.z = t * 0.5
    if (gear2Ref.current) gear2Ref.current.rotation.z = -t * 0.5
  })

  return (
    <group position={position} rotation={degToEuler(rotation === 0 ? 270 : rotation)}>
      <group ref={gear1Ref} position={[-0.18, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.06, 12]} />
          <meshToonMaterial {...gearToon} />
        </mesh>
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i / 8) * Math.PI * 2
          return (
            <mesh key={`item-${i}`} position={[Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, 0]}>
              <boxGeometry args={[0.06, 0.06, 0.06]} />
              <meshToonMaterial {...gearToon} />
            </mesh>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 0.08, 8]} />
          <meshToonMaterial {...axleToon} />
        </mesh>
      </group>
      <group ref={gear2Ref} position={[0.2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.14, 0.14, 0.06, 10]} />
          <meshToonMaterial {...gearToon} />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i / 6) * Math.PI * 2
          return (
            <mesh key={`item-${i}`} position={[Math.cos(angle) * 0.16, Math.sin(angle) * 0.16, 0]}>
              <boxGeometry args={[0.05, 0.05, 0.06]} />
              <meshToonMaterial {...gearToon} />
            </mesh>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
          <meshToonMaterial {...axleToon} />
        </mesh>
      </group>
    </group>
  )
}

// ─── SignalWavesProp ────────────────────────────────────────────

export function SignalWavesProp({ position }: PropProps) {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)
  const waveFrameSkip = useRef(0)

  useFrame(({ clock }) => {
    if (++waveFrameSkip.current % 2 !== 0) return
    const t = clock.getElapsedTime()
    const refs = [ring1Ref, ring2Ref, ring3Ref]
    refs.forEach((ref, i) => {
      if (ref.current) {
        const phase = (t * 0.8 + i * 0.7) % 2
        const scl = 0.5 + phase * 0.8
        ref.current.scale.set(scl, scl, scl)
        const mat = ref.current.material as THREE.MeshStandardMaterial
        mat.opacity = Math.max(0, 1 - phase / 2) * 0.4
      }
    })
  })

  return (
    <group position={position}>
      {[ring1Ref, ring2Ref, ring3Ref].map((ref, i) => (
        <mesh key={`ref-${i}`} ref={ref} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.02, 8, 24]} />
          <meshStandardMaterial
            color="#60A5FA"
            emissive="#60A5FA"
            emissiveIntensity={0.5}
            transparent
            opacity={0.4}
          />
        </mesh>
      ))}
    </group>
  )
}

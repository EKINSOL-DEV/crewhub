import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { getToonMaterialProps } from '../../utils/toonMaterials'
import { FullscreenPropMaker } from './FullscreenPropMaker'
import type { PropPart } from './DynamicProp'
import * as THREE from 'three'

export interface GeneratedPropData {
  name: string
  filename: string
  parts: PropPart[]
  timestamp: number
}

interface PropMakerMachineProps {
  readonly position?: [number, number, number]
  readonly rotation?: number
  readonly onPropGenerated?: (prop: GeneratedPropData) => void
}

export function PropMakerMachine({
  position = [0, 0, 0],
  rotation = 0,
  onPropGenerated,
}: PropMakerMachineProps) {
  const [hovered, setHovered] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)

  const coreRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  const baseToon = getToonMaterialProps('#1a1a2e')
  const panelToon = getToonMaterialProps('#16213e')
  const trimToon = getToonMaterialProps('#0f3460')

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (coreRef.current) {
      coreRef.current.position.y = 1.6 + Math.sin(t * 1.5) * 0.08
      coreRef.current.rotation.y = t * 0.8
      coreRef.current.rotation.x = Math.sin(t * 0.5) * 0.2
    }
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.4
    }
  })

  return (
    <group
      position={position}
      rotation={[0, (rotation * Math.PI) / 180, 0]}
      onPointerOver={() => {
        setHovered(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'auto'
      }}
      onClick={(e) => {
        e.stopPropagation()
        setShowFullscreen(true)
      }}
    >
      {/* Base */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.8, 0.2, 6]} />
        <meshToonMaterial {...baseToon} />
      </mesh>

      {/* Base ring */}
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[0.65, 0.03, 8, 6]} />
        <meshStandardMaterial
          color={hovered ? '#00ffcc' : '#0f3460'}
          emissive={hovered ? '#00ffcc' : '#0f3460'}
          emissiveIntensity={hovered ? 2 : 0.8}
          toneMapped={false}
        />
      </mesh>

      {/* Body */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.5, 0.9, 6]} />
        <meshToonMaterial {...panelToon} />
      </mesh>

      {/* Screen */}
      <group position={[0, 0.95, 0.3]} rotation={[-0.3, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.3, 0.04]} />
          <meshToonMaterial {...trimToon} />
        </mesh>
        <mesh position={[0, 0, 0.021]}>
          <boxGeometry args={[0.42, 0.22, 0.01]} />
          <meshStandardMaterial
            color={hovered ? '#00ffcc' : '#e94560'}
            emissive={hovered ? '#00ffcc' : '#e94560'}
            emissiveIntensity={hovered ? 1.5 : 0.6}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* Floating ring */}
      <mesh ref={ringRef} position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.02, 8, 32]} />
        <meshStandardMaterial
          color="#00ffcc"
          emissive="#00ffcc"
          emissiveIntensity={hovered ? 3 : 1.2}
          transparent
          opacity={hovered ? 0.9 : 0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Floating core */}
      <mesh ref={coreRef} position={[0, 1.6, 0]}>
        <octahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial
          color="#00ffcc"
          emissive="#00ffcc"
          emissiveIntensity={hovered ? 4 : 2}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>

      {/* Side pillars with indicator lights */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.55, 0, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.12, 0.6, 0.12]} />
            <meshToonMaterial {...trimToon} />
          </mesh>
          {[0.2, 0.35, 0.5].map((y, i) => (
            <mesh key={y} position={[side * 0.061, y, 0]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial
                color={['#00ffcc', '#e94560', '#ffd700'][i]}
                emissive={['#00ffcc', '#e94560', '#ffd700'][i]}
                emissiveIntensity={1.5}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Point light */}
      <pointLight
        position={[0, 1.6, 0]}
        color="#00ffcc"
        intensity={hovered ? 3 : 1}
        distance={4}
        decay={2}
      />

      {/* Hover tooltip */}
      {hovered && !showFullscreen && (
        <Html position={[0, 2.2, 0]} center>
          <div
            style={{
              background: 'rgba(0,0,0,0.8)',
              color: '#00ffcc',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            Click to open Prop Maker
          </div>
        </Html>
      )}

      {/* Fullscreen Prop Maker */}
      {showFullscreen && (
        <Html>
          <FullscreenPropMaker
            onClose={() => setShowFullscreen(false)}
            onPropGenerated={onPropGenerated}
          />
        </Html>
      )}
    </group>
  )
}

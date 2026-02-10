import { useState, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useToonMaterialProps } from '../../utils/toonMaterials'
import * as THREE from 'three'

interface PropMakerMachineProps {
  position?: [number, number, number]
  rotation?: number
}

/**
 * Futuristic prop fabricator machine — a glowing sci-fi console
 * that will eventually open a chat dialog for AI-powered prop creation.
 * 
 * Visual: cylindrical base + holographic ring + floating core crystal.
 */
export function PropMakerMachine({ position = [0, 0, 0], rotation = 0 }: PropMakerMachineProps) {
  const [hovered, setHovered] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const coreRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  const baseToon = useToonMaterialProps('#1a1a2e')
  const panelToon = useToonMaterialProps('#16213e')
  const trimToon = useToonMaterialProps('#0f3460')
  void useToonMaterialProps('#e94560') // reserved for screen

  // Animate floating core and ring rotation
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

  const handleClick = () => {
    setDialogOpen(!dialogOpen)
  }

  return (
    <group
      position={position}
      rotation={[0, (rotation * Math.PI) / 180, 0]}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); handleClick() }}
    >
      {/* Base platform — hexagonal feel */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.8, 0.2, 6]} />
        <meshToonMaterial {...baseToon} />
      </mesh>

      {/* Base ring glow */}
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[0.65, 0.03, 8, 6]} />
        <meshStandardMaterial
          color={hovered ? '#00ffcc' : '#0f3460'}
          emissive={hovered ? '#00ffcc' : '#0f3460'}
          emissiveIntensity={hovered ? 2 : 0.8}
          toneMapped={false}
        />
      </mesh>

      {/* Console pillar */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.5, 0.9, 6]} />
        <meshToonMaterial {...panelToon} />
      </mesh>

      {/* Angled screen panel */}
      <group position={[0, 0.95, 0.3]} rotation={[-0.3, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.3, 0.04]} />
          <meshToonMaterial {...trimToon} />
        </mesh>
        {/* Screen surface */}
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

      {/* Holographic ring (rotates) */}
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

      {/* Floating core crystal */}
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

      {/* Side data pillars */}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.55, 0, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.12, 0.6, 0.12]} />
            <meshToonMaterial {...trimToon} />
          </mesh>
          {/* Small indicator lights */}
          {[0.2, 0.35, 0.5].map((y, i) => (
            <mesh key={i} position={[side * 0.061, y, 0]}>
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

      {/* Point light from core */}
      <pointLight
        position={[0, 1.6, 0]}
        color="#00ffcc"
        intensity={hovered ? 3 : 1}
        distance={4}
        decay={2}
      />

      {/* Chat dialog (placeholder) */}
      {dialogOpen && (
        <Html position={[0, 2.5, 0]} center zIndexRange={[100, 110]}>
          <div
            style={{
              width: '320px',
              background: 'rgba(10, 10, 30, 0.95)',
              border: '1px solid rgba(0, 255, 204, 0.4)',
              borderRadius: '16px',
              padding: '20px',
              fontFamily: 'system-ui, sans-serif',
              color: '#fff',
              boxShadow: '0 0 30px rgba(0, 255, 204, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#00ffcc' }}>
                🔧 Prop Maker
              </span>
              <button
                onClick={() => setDialogOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '0 4px',
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: '#aaa', margin: '0 0 16px 0', lineHeight: 1.5 }}>
              Describe the prop you want to create. The AI fabricator will generate a 3D object for your world.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. A glowing mushroom lamp..."
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(0, 255, 204, 0.3)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button
                style={{
                  background: 'linear-gradient(135deg, #00ffcc, #0f3460)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Create
              </button>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
              ⚡ AI subagent integration coming soon
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

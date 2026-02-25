import * as THREE from 'three'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

// ═══════════════════════════════════════════════
// HIGH-QUALITY INTERIOR PROPS
// ═══════════════════════════════════════════════

export function Desk({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number], color = '#6B5B45' }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[1.4, 0.04, 0.7]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Legs - tapered */}
      {[[-0.6, 0.37, -0.28], [0.6, 0.37, -0.28], [-0.6, 0.37, 0.28], [0.6, 0.37, 0.28]].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.02, 0.03, 0.74, 6]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
      {/* Cable management tray */}
      <mesh position={[0, 0.65, -0.2]}>
        <boxGeometry args={[0.8, 0.03, 0.15]} />
        <meshStandardMaterial color="#444" metalness={0.5} />
      </mesh>
    </group>
  )
}

export function Monitor({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number], screenColor = '#1a2a3a' }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Screen bezel */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <boxGeometry args={[0.56, 0.38, 0.02]} />
        <meshStandardMaterial color="#111" roughness={0.3} />
      </mesh>
      {/* Screen */}
      <mesh position={[0, 1.0, 0.012]}>
        <planeGeometry args={[0.5, 0.32]} />
        <meshStandardMaterial color={screenColor} emissive={screenColor} emissiveIntensity={0.8} roughness={0} />
      </mesh>
      {/* Thin neck */}
      <mesh position={[0, 0.82, -0.02]}>
        <boxGeometry args={[0.03, 0.08, 0.06]} />
        <meshStandardMaterial color="#222" metalness={0.9} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.77, -0.02]}>
        <cylinderGeometry args={[0.1, 0.12, 0.02, 16]} />
        <meshStandardMaterial color="#222" metalness={0.9} />
      </mesh>
    </group>
  )
}

export function Chair({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number], color = '#2a2a2a' }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Seat */}
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[0.44, 0.06, 0.44]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Back - curved via slight rotation */}
      <mesh position={[0, 0.75, -0.19]} rotation={[0.1, 0, 0]}>
        <boxGeometry args={[0.42, 0.55, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {/* Pneumatic post */}
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.35, 8]} />
        <meshStandardMaterial color="#666" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Star base */}
      {[0, 1.256, 2.513, 3.77, 5.027].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.15, 0.06, Math.sin(a) * 0.15]} rotation={[0, a, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 0.3, 4]} />
          <meshStandardMaterial color="#555" metalness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

export function Workstation({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <Desk />
      <Monitor position={[0.15, 0, -0.05]} />
      <Monitor position={[-0.2, 0, -0.05]} />
      <Chair position={[0, 0, 0.65]} rotation={[0, Math.PI, 0]} />
    </group>
  )
}

export function Plant({ position = [0, 0, 0] as [number, number, number], scale = 1, variant = 0 }) {
  const colors = ['#2d7d46', '#3a8a4a', '#1e6b35', '#4a9e5a']
  const c = colors[variant % colors.length]
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.16, 0.11, 0.36, 8]} />
        <meshStandardMaterial color="#6B4226" roughness={0.9} />
      </mesh>
      {/* Multi-sphere foliage */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.22, 8, 6]} />
        <meshStandardMaterial color={c} roughness={0.8} />
      </mesh>
      <mesh position={[0.08, 0.62, 0.05]}>
        <sphereGeometry args={[0.15, 7, 5]} />
        <meshStandardMaterial color={c} roughness={0.8} />
      </mesh>
      <mesh position={[-0.06, 0.58, -0.06]}>
        <sphereGeometry args={[0.13, 7, 5]} />
        <meshStandardMaterial color={c} roughness={0.8} />
      </mesh>
    </group>
  )
}

export function TallPlant({ position = [0, 0, 0] as [number, number, number] }) {
  return (
    <group position={position}>
      {/* Planter */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.25, 0.2, 0.6, 12]} />
        <meshStandardMaterial color="#555" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Trunk */}
      <mesh position={[0, 1.0, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 1.2, 6]} />
        <meshStandardMaterial color="#5C4033" roughness={0.9} />
      </mesh>
      {/* Canopy */}
      <mesh position={[0, 1.7, 0]}>
        <sphereGeometry args={[0.45, 10, 8]} />
        <meshStandardMaterial color="#2d7d46" roughness={0.85} />
      </mesh>
      <mesh position={[0.15, 1.9, 0.1]}>
        <sphereGeometry args={[0.3, 8, 6]} />
        <meshStandardMaterial color="#3a8a4a" roughness={0.85} />
      </mesh>
    </group>
  )
}

export function ServerRack({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.6, 2, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Rack units */}
      {[0.2, 0.5, 0.8, 1.1, 1.4, 1.7].map((y, i) => (
        <group key={i}>
          <mesh position={[0, y, 0.26]}>
            <boxGeometry args={[0.52, 0.18, 0.01]} />
            <meshStandardMaterial color="#222" metalness={0.8} />
          </mesh>
          {/* Status LEDs */}
          <mesh position={[0.2, y, 0.27]}>
            <sphereGeometry args={[0.012, 6, 4]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? '#ff4444' : '#44ff44'}
              emissive={i % 3 === 0 ? '#ff4444' : '#44ff44'}
              emissiveIntensity={3}
            />
          </mesh>
          <mesh position={[0.23, y, 0.27]}>
            <sphereGeometry args={[0.012, 6, 4]} />
            <meshStandardMaterial color="#44ff44" emissive="#44ff44" emissiveIntensity={2} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function Whiteboard({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[1.8, 1.2, 0.04]} />
        <meshStandardMaterial color="#f8f8f8" roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.5, -0.025]}>
        <boxGeometry args={[1.9, 1.3, 0.02]} />
        <meshStandardMaterial color="#888" metalness={0.6} />
      </mesh>
      {/* Marker tray */}
      <mesh position={[0, 0.88, 0.04]}>
        <boxGeometry args={[0.5, 0.03, 0.06]} />
        <meshStandardMaterial color="#999" metalness={0.5} />
      </mesh>
    </group>
  )
}

export function MeetingTable({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number], seats = 6 }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Oval table top */}
      <mesh position={[0, 0.74, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.9, 0.04, 24]} />
        <meshStandardMaterial color="#5C4033" roughness={0.35} />
      </mesh>
      {/* Central pedestal */}
      <mesh position={[0, 0.37, 0]}>
        <cylinderGeometry args={[0.06, 0.15, 0.74, 8]} />
        <meshStandardMaterial color="#444" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.04, 16]} />
        <meshStandardMaterial color="#444" metalness={0.9} />
      </mesh>
      {/* Chairs around */}
      {Array.from({ length: seats }).map((_, i) => {
        const a = (i / seats) * Math.PI * 2
        return <Chair key={i} position={[Math.cos(a) * 1.3, 0, Math.sin(a) * 1.3]} rotation={[0, -a + Math.PI, 0]} />
      })}
    </group>
  )
}

export function Sofa({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number], color = '#4a3728' }) {
  return (
    <group position={position} rotation={rotation}>
      {/* Seat */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.6, 0.2, 0.7]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {/* Back */}
      <mesh position={[0, 0.55, -0.28]} castShadow>
        <boxGeometry args={[1.6, 0.5, 0.15]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {/* Arms */}
      <mesh position={[0.72, 0.42, 0]}>
        <boxGeometry args={[0.15, 0.35, 0.7]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      <mesh position={[-0.72, 0.42, 0]}>
        <boxGeometry args={[0.15, 0.35, 0.7]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
    </group>
  )
}

export function CoffeeTable({ position = [0, 0, 0] as [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.4, 0.4, 0.03, 16]} />
        <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.34, 8]} />
        <meshStandardMaterial color="#444" metalness={0.9} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 12]} />
        <meshStandardMaterial color="#444" metalness={0.9} />
      </mesh>
    </group>
  )
}

export function Stairs({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number], steps = 10, height = 3, width = 1.5 }) {
  const stepH = height / steps
  const stepD = 0.3
  return (
    <group position={position} rotation={rotation}>
      {Array.from({ length: steps }).map((_, i) => (
        <mesh key={i} position={[0, stepH * i + stepH / 2, stepD * i]} castShadow>
          <boxGeometry args={[width, stepH, stepD]} />
          <meshStandardMaterial color="#556" roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {/* Railing */}
      <mesh position={[width / 2 + 0.03, height / 2 + 0.4, steps * stepD / 2]} rotation={[Math.atan2(height, steps * stepD), 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, Math.sqrt(height * height + (steps * stepD) ** 2), 6]} />
        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  )
}

export function HangingLight({ position = [0, 0, 0] as [number, number, number], color = '#ffddaa' }) {
  return (
    <group position={position}>
      {/* Wire */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.6, 4]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      {/* Shade */}
      <mesh>
        <coneGeometry args={[0.2, 0.15, 12, 1, true]} />
        <meshStandardMaterial color="#222" side={THREE.DoubleSide} metalness={0.7} />
      </mesh>
      {/* Bulb glow */}
      <pointLight color={color} intensity={0.5} distance={4} />
      <mesh position={[0, -0.02, 0]}>
        <sphereGeometry args={[0.04, 8, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} />
      </mesh>
    </group>
  )
}

export function Floor({ size = [10, 10] as [number, number], color = '#2a2a3a', position = [0, 0, 0] as [number, number, number] }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  )
}

export function Pillar({ position = [0, 0, 0] as [number, number, number], height = 3, radius = 0.15, color = '#667' }) {
  return (
    <mesh position={[position[0], position[1] + height / 2, position[2]]} castShadow>
      <cylinderGeometry args={[radius, radius, height, 12]} />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.5} />
    </mesh>
  )
}

export function GlassPanel({ position = [0, 0, 0] as [number, number, number], rotation = [0, 0, 0] as [number, number, number], size = [2, 3] as [number, number] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshPhysicalMaterial
        color="#88ccee"
        transparent
        opacity={0.15}
        roughness={0}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

export function Rug({ position = [0, 0, 0] as [number, number, number], size = [2, 3] as [number, number], color = '#4a3040' }) {
  return (
    <mesh position={[position[0], position[1] + 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  )
}

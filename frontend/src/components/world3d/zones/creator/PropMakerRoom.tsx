import { useToonMaterialProps } from '../../utils/toonMaterials'
import { PropMakerMachine } from './PropMakerMachine'
import * as THREE from 'three'

interface PropMakerRoomProps {
  position?: [number, number, number]
  size?: number
}

/**
 * Creator Zone — Prop Maker Room
 * A special workshop area with a futuristic fabricator machine at the center.
 * Features a tech-lab floor, workbench walls, and the PropMakerMachine.
 */
export function PropMakerRoom({ position = [0, 0, 0], size = 10 }: PropMakerRoomProps) {
  const half = size / 2
  const floorToon = useToonMaterialProps('#1a1a2e')
  const wallToon = useToonMaterialProps('#16213e')
  void useToonMaterialProps('#0f3460') // reserved for trim

  return (
    <group position={position}>
      {/* Floor — dark tech grid */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshToonMaterial {...floorToon} side={THREE.DoubleSide} />
      </mesh>

      {/* Floor grid lines (subtle) */}
      {Array.from({ length: Math.floor(size) + 1 }).map((_, i) => {
        const offset = -half + i
        return (
          <group key={`grid-${i}`}>
            <mesh position={[offset, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.02, size]} />
              <meshBasicMaterial color="#0f3460" transparent opacity={0.3} />
            </mesh>
            <mesh position={[0, 0.015, offset]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[size, 0.02]} />
              <meshBasicMaterial color="#0f3460" transparent opacity={0.3} />
            </mesh>
          </group>
        )
      })}

      {/* Walls */}
      {[
        { pos: [0, 1.5, -half] as [number, number, number], rot: [0, 0, 0] as [number, number, number], w: size },
        { pos: [0, 1.5, half] as [number, number, number], rot: [0, Math.PI, 0] as [number, number, number], w: size },
        { pos: [-half, 1.5, 0] as [number, number, number], rot: [0, Math.PI / 2, 0] as [number, number, number], w: size },
        { pos: [half, 1.5, 0] as [number, number, number], rot: [0, -Math.PI / 2, 0] as [number, number, number], w: size },
      ].map((wall, i) => (
        <mesh key={i} position={wall.pos} rotation={wall.rot} castShadow>
          <boxGeometry args={[wall.w, 3, 0.15]} />
          <meshToonMaterial {...wallToon} />
        </mesh>
      ))}

      {/* Neon trim strips along wall tops */}
      {[
        [0, 2.95, -half + 0.08],
        [0, 2.95, half - 0.08],
        [-half + 0.08, 2.95, 0],
        [half - 0.08, 2.95, 0],
      ].map((pos, i) => (
        <mesh key={`trim-${i}`} position={pos as [number, number, number]} rotation={i < 2 ? [0, 0, 0] : [0, Math.PI / 2, 0]}>
          <boxGeometry args={[size - 0.3, 0.06, 0.02]} />
          <meshStandardMaterial
            color="#00ffcc"
            emissive="#00ffcc"
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Corner accent lights */}
      {[
        [-half + 0.5, 0, -half + 0.5],
        [half - 0.5, 0, -half + 0.5],
        [-half + 0.5, 0, half - 0.5],
        [half - 0.5, 0, half - 0.5],
      ].map((pos, i) => (
        <pointLight
          key={`corner-${i}`}
          position={pos as [number, number, number]}
          color="#0f3460"
          intensity={0.5}
          distance={5}
          decay={2}
        />
      ))}

      {/* Center fabricator machine */}
      <PropMakerMachine position={[0, 0, 0]} />

      {/* Room label */}
      <mesh position={[0, 2.8, -half + 0.2]}>
        <boxGeometry args={[3, 0.4, 0.02]} />
        <meshStandardMaterial
          color="#0a0a1e"
          emissive="#0f3460"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Ambient fill */}
      <ambientLight intensity={0.15} />
    </group>
  )
}

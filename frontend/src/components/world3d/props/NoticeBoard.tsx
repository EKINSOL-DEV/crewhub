import { Html } from '@react-three/drei'
import { useToonMaterialProps, WARM_COLORS } from '../utils/toonMaterials'

interface NoticeBoardProps {
  readonly position?: [number, number, number]
  readonly rotation?: [number, number, number]
}

/**
 * Wall-mounted notice/bulletin board with pinned notes.
 */
export function NoticeBoard({ position = [0, 0, 0], rotation = [0, 0, 0] }: NoticeBoardProps) {
  const frameToon = useToonMaterialProps(WARM_COLORS.wood)
  const boardToon = useToonMaterialProps('#C4956A')
  const noteToon1 = useToonMaterialProps('#FFFACD') // yellow sticky
  const noteToon2 = useToonMaterialProps('#FFB6C1') // pink sticky
  const noteToon3 = useToonMaterialProps('#B0E0E6') // blue sticky
  const pinToon = useToonMaterialProps('#CC3333')

  return (
    <group position={position} rotation={rotation}>
      {/* Board frame */}
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.8, 0.06]} />
        <meshToonMaterial {...frameToon} />
      </mesh>

      {/* Cork surface */}
      <mesh position={[0, 0, 0.031]}>
        <boxGeometry args={[1.05, 0.65, 0.01]} />
        <meshToonMaterial {...boardToon} />
      </mesh>

      {/* Sticky notes */}
      {[
        { pos: [-0.25, 0.12, 0.04] as [number, number, number], toon: noteToon1, rot: 0.05 },
        { pos: [0.2, 0.1, 0.04] as [number, number, number], toon: noteToon2, rot: -0.08 },
        { pos: [-0.1, -0.15, 0.04] as [number, number, number], toon: noteToon3, rot: 0.12 },
      ].map((note, i) => (
        <group key={`note-${i}`}>
          <mesh position={note.pos} rotation={[0, 0, note.rot]}>
            <boxGeometry args={[0.3, 0.25, 0.005]} />
            <meshToonMaterial {...note.toon} />
          </mesh>
          {/* Push pin */}
          <mesh position={[note.pos[0], note.pos[1] + 0.09, note.pos[2] + 0.01]}>
            <sphereGeometry args={[0.02, 6, 6]} />
            <meshToonMaterial {...pinToon} />
          </mesh>
        </group>
      ))}

      {/* Small label */}
      <Html zIndexRange={[1, 5]} position={[0, -0.48, 0.04]} center transform distanceFactor={6}>
        <span
          style={{
            color: '#666',
            fontSize: '8px',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          📌 Notice Board
        </span>
      </Html>
    </group>
  )
}

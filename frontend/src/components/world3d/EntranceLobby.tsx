import { Html } from '@react-three/drei'
import { Plant } from './props/Plant'
import { useToonMaterialProps } from './utils/toonMaterials'

interface EntranceLobbyProps {
  /** X position of entrance center */
  entranceX: number
  /** Z position of building front wall */
  buildingFrontZ: number
  entranceWidth?: number
}

/**
 * Small entrance/lobby area at the front of the building.
 * Welcome mat, flanking plants, and a small sign.
 */
export function EntranceLobby({
  entranceX,
  buildingFrontZ,
  entranceWidth = 5,
}: EntranceLobbyProps) {
  const matToon = useToonMaterialProps('#8B5A2B')
  const matBorderToon = useToonMaterialProps('#6B4226')
  const pathToon = useToonMaterialProps('#C8B898')

  // Front wall is at -Z, so lobby extends further into -Z
  const lobbyZ = buildingFrontZ - 1.5

  return (
    <group>
      {/* Welcome mat just outside the entrance */}
      <group position={[entranceX, 0.15, lobbyZ]}>
        {/* Mat border */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <boxGeometry args={[3, 1.8, 0.03]} />
          <meshToonMaterial {...matBorderToon} />
        </mesh>
        {/* Mat inner */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
          <boxGeometry args={[2.6, 1.4, 0.02]} />
          <meshToonMaterial {...matToon} />
        </mesh>

        {/* Welcome text */}
        <Html
          zIndexRange={[1, 5]}
          position={[0, 0.06, 0]}
          center
          transform
          distanceFactor={5}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <span
            style={{
              color: '#FFF8E8',
              fontSize: '10px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              userSelect: 'none',
              pointerEvents: 'none',
              letterSpacing: '2px',
            }}
          >
            WELCOME
          </span>
        </Html>
      </group>

      {/* Path leading from entrance outward (into -Z) */}
      {Array.from({ length: 4 }, (_, i) => (
        <mesh
          key={`path-${i}`}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[entranceX, 0.05, lobbyZ - 2 - i * 1.8]}
          receiveShadow
        >
          <boxGeometry args={[entranceWidth * 0.6 - i * 0.3, 1.5, 0.06]} />
          <meshToonMaterial {...pathToon} />
        </mesh>
      ))}

      {/* Flanking plants at entrance pillars */}
      <Plant
        position={[entranceX - entranceWidth / 2 - 0.3, 0.02, buildingFrontZ - 0.5]}
        scale={1.2}
      />
      <Plant
        position={[entranceX + entranceWidth / 2 + 0.3, 0.02, buildingFrontZ - 0.5]}
        scale={1.2}
      />

      {/* Additional plants flanking the path */}
      <Plant position={[entranceX - 2.5, 0.03, lobbyZ - 3]} scale={0.9} potColor="#6B4F12" />
      <Plant position={[entranceX + 2.5, 0.03, lobbyZ - 3]} scale={0.9} potColor="#6B4F12" />
    </group>
  )
}

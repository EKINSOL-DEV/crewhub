import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { WorldLighting } from './WorldLighting'
import { Room3D } from './Room3D'
import { useRooms } from '@/hooks/useRooms'
import { useToonMaterialProps, WARM_COLORS } from './utils/toonMaterials'
import type { CrewSession } from '@/lib/api'
import type { SessionsSettings } from '@/components/sessions/SettingsPanel'

interface World3DViewProps {
  sessions: CrewSession[]
  settings: SessionsSettings
  onAliasChanged?: () => void
}

/** Large ground plane under / around rooms */
function GroundPlane() {
  const toonProps = useToonMaterialProps(WARM_COLORS.ground)

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.15, 0]}
      receiveShadow
    >
      <boxGeometry args={[80, 80, 0.1]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}

/** Loading fallback inside the canvas */
function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4f46e5" wireframe />
    </mesh>
  )
}

/** Scene content rendered inside <Canvas> */
function SceneContent() {
  const { rooms, isLoading } = useRooms()

  // Compute room positions in a 2-column grid layout
  const roomPositions = useMemo(() => {
    const sorted = [...rooms].sort((a, b) => a.sort_order - b.sort_order)
    const spacing = 16 // distance between room centers
    const cols = 2

    return sorted.map((room, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      const x = (col - (cols - 1) / 2) * spacing
      const z = row * spacing
      return { room, position: [x, 0, z] as [number, number, number] }
    })
  }, [rooms])

  if (isLoading || rooms.length === 0) return null

  return (
    <>
      {/* Rooms */}
      {roomPositions.map(({ room, position }) => (
        <Room3D
          key={room.id}
          room={room}
          position={position}
          size={12}
        />
      ))}
    </>
  )
}

/**
 * Main 3D World view — Phase 1.
 * Renders toon-shaded rooms with props in an isometric camera view.
 * Bots are NOT rendered yet (Phase 2).
 */
export function World3DView({ sessions: _sessions, settings: _settings, onAliasChanged: _onAliasChanged }: World3DViewProps) {
  // sessions/settings/onAliasChanged reserved for Phase 2+ (bot rendering, interactivity)
  void _sessions
  void _settings
  void _onAliasChanged

  return (
    <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
      <Canvas
        shadows
        camera={{
          position: [20, 20, 20],
          fov: 35,
          near: 0.1,
          far: 200,
        }}
        style={{
          background: 'linear-gradient(180deg, #87CEEB 0%, #C9E8F5 40%, #E8F0E8 100%)',
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          {/* Lighting */}
          <WorldLighting />

          {/* Ground plane */}
          <GroundPlane />

          {/* Room content */}
          <SceneContent />

          {/* Camera controls */}
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableRotate
            minDistance={10}
            maxDistance={60}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 3}
            target={[0, 0, 0]}
          />
        </Suspense>
      </Canvas>

      {/* Overlay controls hint */}
      <div className="absolute top-4 right-4 z-50">
        <div className="text-xs px-3 py-1.5 rounded-lg backdrop-blur-md text-gray-700 bg-white/60 border border-gray-200/50 shadow-sm">
          🖱️ Drag: Rotate · Scroll: Zoom · Right-drag: Pan
        </div>
      </div>

      {/* Info bar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="text-sm px-4 py-2 rounded-full backdrop-blur-md text-gray-700 bg-white/60 shadow-sm border border-gray-200/50">
          🏠 3D World — Phase 1
        </div>
      </div>
    </div>
  )
}

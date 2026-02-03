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

/** Procedural grass tile for variation */
function GrassTile({ position, size, shade }: { position: [number, number, number]; size: number; shade: number }) {
  const baseGreen = [0.38 + shade * 0.06, 0.50 + shade * 0.05, 0.32 + shade * 0.04]
  const color = `rgb(${Math.floor(baseGreen[0] * 255)}, ${Math.floor(baseGreen[1] * 255)}, ${Math.floor(baseGreen[2] * 255)})`
  const toonProps = useToonMaterialProps(color)

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <boxGeometry args={[size, size, 0.08 + shade * 0.04]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}

/** Small decorative grass tuft */
function GrassTuft({ position }: { position: [number, number, number] }) {
  const toonProps = useToonMaterialProps('#5A8A3C')
  return (
    <group position={position}>
      {[-0.08, 0, 0.08].map((offset, i) => (
        <mesh key={i} position={[offset, 0.15, 0]} rotation={[0, 0, (i - 1) * 0.3]}>
          <boxGeometry args={[0.06, 0.3, 0.04]} />
          <meshToonMaterial {...toonProps} />
        </mesh>
      ))}
    </group>
  )
}

/** Small decorative stone */
function SmallRock({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const toonProps = useToonMaterialProps(WARM_COLORS.stone)
  return (
    <mesh position={position} scale={scale} castShadow>
      <dodecahedronGeometry args={[0.2, 0]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}

/** Pathway between rooms */
function Pathway({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const toonProps = useToonMaterialProps(WARM_COLORS.stoneLight)
  const dx = to[0] - from[0]
  const dz = to[2] - from[2]
  const length = Math.sqrt(dx * dx + dz * dz)

  return (
    <group>
      {/* Path stones */}
      {Array.from({ length: Math.floor(length / 1.2) }, (_, i) => {
        const t = (i + 0.5) / Math.floor(length / 1.2)
        const x = from[0] + dx * t + (Math.sin(i * 3.7) * 0.15)
        const z = from[2] + dz * t + (Math.cos(i * 2.3) * 0.15)
        const stoneSize = 0.4 + Math.sin(i * 5.1) * 0.15
        return (
          <mesh key={i} rotation={[-Math.PI / 2, Math.sin(i * 1.7) * 0.3, 0]} position={[x, -0.09, z]} receiveShadow>
            <circleGeometry args={[stoneSize, 6]} />
            <meshToonMaterial {...toonProps} />
          </mesh>
        )
      })}
    </group>
  )
}

/** Large ground plane with grass tile grid, decorations, and pathways */
function GroundPlane({ roomPositions }: { roomPositions: { position: [number, number, number] }[] }) {
  // Seeded pseudo-random for consistent variation
  const seed = (x: number, z: number) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1

  const tileSize = 4
  const gridRange = 15 // tiles in each direction from center
  const tiles: { pos: [number, number, number]; shade: number }[] = []
  const decorations: { type: 'tuft' | 'rock'; pos: [number, number, number]; scale?: number }[] = []

  for (let gx = -gridRange; gx <= gridRange; gx++) {
    for (let gz = -gridRange; gz <= gridRange; gz++) {
      const wx = gx * tileSize
      const wz = gz * tileSize
      const s = seed(gx, gz)

      // Skip tiles that overlap with rooms (leave room footprint clear)
      const isInsideRoom = roomPositions.some(({ position: rp }) => {
        return Math.abs(wx - rp[0]) < 7.5 && Math.abs(wz - rp[2]) < 7.5
      })
      if (isInsideRoom) continue

      tiles.push({ pos: [wx, -0.15, wz], shade: s })

      // Random decorations on some tiles
      if (s > 0.75) {
        decorations.push({ type: 'tuft', pos: [wx + s * 1.5 - 0.75, -0.1, wz + (1 - s) * 1.5 - 0.75] })
      }
      if (s > 0.88) {
        decorations.push({ type: 'rock', pos: [wx + s * 2 - 1, -0.05, wz - s * 1.5 + 0.75], scale: 0.5 + s * 0.8 })
      }
    }
  }

  // Generate pathways between adjacent rooms
  const pathways: { from: [number, number, number]; to: [number, number, number] }[] = []
  for (let i = 0; i < roomPositions.length; i++) {
    for (let j = i + 1; j < roomPositions.length; j++) {
      const a = roomPositions[i].position
      const b = roomPositions[j].position
      const dist = Math.sqrt((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2)
      if (dist < 20) { // only connect nearby rooms
        pathways.push({ from: a, to: b })
      }
    }
  }

  return (
    <group>
      {/* Grass tiles */}
      {tiles.map((tile, i) => (
        <GrassTile key={i} position={tile.pos} size={tileSize} shade={tile.shade} />
      ))}
      {/* Decorations */}
      {decorations.map((dec, i) =>
        dec.type === 'tuft'
          ? <GrassTuft key={`d${i}`} position={dec.pos} />
          : <SmallRock key={`d${i}`} position={dec.pos} scale={dec.scale} />
      )}
      {/* Pathways between rooms */}
      {pathways.map((pw, i) => (
        <Pathway key={`p${i}`} from={pw.from} to={pw.to} />
      ))}
    </group>
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

  // Compute room positions in a centered 2-column grid layout
  const roomPositions = useMemo(() => {
    const sorted = [...rooms].sort((a, b) => a.sort_order - b.sort_order)
    const spacing = 16 // distance between room centers
    const cols = Math.min(sorted.length, 3) // up to 3 columns
    const totalRows = Math.ceil(sorted.length / cols)

    // Center the grid around origin
    const offsetX = ((cols - 1) * spacing) / 2
    const offsetZ = ((totalRows - 1) * spacing) / 2

    return sorted.map((room, index) => {
      const row = Math.floor(index / cols)
      const col = index % cols
      const x = col * spacing - offsetX
      const z = row * spacing - offsetZ
      return { room, position: [x, 0, z] as [number, number, number] }
    })
  }, [rooms])

  if (isLoading || rooms.length === 0) return null

  return (
    <>
      {/* Ground with grass, rocks, paths */}
      <GroundPlane roomPositions={roomPositions} />

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
          position: [35, 30, 35],
          fov: 40,
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

          {/* Room content (includes ground) */}
          <SceneContent />

          {/* Camera controls */}
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableRotate
            minDistance={10}
            maxDistance={80}
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

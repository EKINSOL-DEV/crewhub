import { Suspense, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { WorldLighting } from './WorldLighting'
import { BuildingFloor } from './BuildingFloor'
import { BuildingWalls } from './BuildingWalls'
import { Hallway } from './Hallway'
import { HallwayFloorLines } from './HallwayFloorLines'
import { EntranceLobby } from './EntranceLobby'
import { ParkingArea3D } from './ParkingArea3D'
import { Room3D } from './Room3D'
import { Bot3D, type BotStatus } from './Bot3D'
import { useRooms } from '@/hooks/useRooms'
import { useAgentsRegistry, type AgentRuntime } from '@/hooks/useAgentsRegistry'
import { useToonMaterialProps } from './utils/toonMaterials'
import { getBotConfigFromSession, getBotDisplayName, isSubagent } from './utils/botVariants'
import type { CrewSession } from '@/lib/api'
import type { SessionsSettings } from '@/components/sessions/SettingsPanel'

interface World3DViewProps {
  sessions: CrewSession[]
  settings: SessionsSettings
  onAliasChanged?: () => void
}

// ─── Layout Constants ──────────────────────────────────────────
const ROOM_SIZE = 12
const HALLWAY_WIDTH = 4
const GRID_SPACING = ROOM_SIZE + HALLWAY_WIDTH // 16
const MAX_COLS = 3
const BUILDING_PADDING = 3 // padding inside building walls around the grid
const PARKING_WIDTH = ROOM_SIZE + 2 // width of parking/break area
const PARKING_DEPTH_MIN = ROOM_SIZE + 2 // minimum depth

// ─── Building Layout Calculation ───────────────────────────────
interface BuildingLayout {
  /** Positions for each room in 3D space */
  roomPositions: { room: ReturnType<typeof useRooms>['rooms'][0]; position: [number, number, number] }[]
  /** Total building dimensions */
  buildingWidth: number
  buildingDepth: number
  /** Parking area bounds (relative to building center) */
  parkingArea: { x: number; z: number; width: number; depth: number }
  /** Entrance position on front wall */
  entranceX: number
  /** Number of columns and rows in the grid */
  cols: number
  rows: number
  /** Grid origin (top-left room center) relative to building center */
  gridOriginX: number
  gridOriginZ: number
}

function calculateBuildingLayout(rooms: ReturnType<typeof useRooms>['rooms']): BuildingLayout {
  const sorted = [...rooms].sort((a, b) => a.sort_order - b.sort_order)
  const roomCount = sorted.length
  const cols = Math.min(roomCount, MAX_COLS)
  const rows = Math.ceil(roomCount / cols)

  // Grid dimensions (just the rooms + hallways between them)
  const gridWidth = cols * ROOM_SIZE + (cols - 1) * HALLWAY_WIDTH
  const gridDepth = rows * ROOM_SIZE + (rows - 1) * HALLWAY_WIDTH

  // Building includes grid + padding + parking area on the right
  const buildingWidth = BUILDING_PADDING * 2 + gridWidth + HALLWAY_WIDTH + PARKING_WIDTH
  const parkingDepth = Math.max(PARKING_DEPTH_MIN, gridDepth)
  const buildingDepth = BUILDING_PADDING * 2 + Math.max(gridDepth, parkingDepth)

  // Grid origin: top-left room center, relative to building center
  const gridOriginX = -buildingWidth / 2 + BUILDING_PADDING + ROOM_SIZE / 2
  const gridOriginZ = -buildingDepth / 2 + BUILDING_PADDING + ROOM_SIZE / 2

  // Room positions
  const roomPositions = sorted.map((room, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const x = gridOriginX + col * GRID_SPACING
    const z = gridOriginZ + row * GRID_SPACING
    return { room, position: [x, 0, z] as [number, number, number] }
  })

  // Parking area on the right side
  const parkingX = gridOriginX + cols * GRID_SPACING + HALLWAY_WIDTH / 2 + PARKING_WIDTH / 2 - ROOM_SIZE / 2
  const parkingZ = 0 // centered vertically
  const parkingArea = {
    x: parkingX,
    z: parkingZ,
    width: PARKING_WIDTH,
    depth: parkingDepth,
  }

  // Entrance centered on the grid, on the front wall (-Z side)
  const entranceX = gridOriginX + ((cols - 1) * GRID_SPACING) / 2

  return {
    roomPositions,
    buildingWidth,
    buildingDepth,
    parkingArea,
    entranceX,
    cols,
    rows,
    gridOriginX,
    gridOriginZ,
  }
}

// ─── Grass Ground (outside building) ───────────────────────────

/** Procedural grass tile */
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
  const toonProps = useToonMaterialProps('#9E9684')
  return (
    <mesh position={position} scale={scale} castShadow>
      <dodecahedronGeometry args={[0.2, 0]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}

/** Grass ground outside the building */
function ExteriorGround({ buildingWidth, buildingDepth }: { buildingWidth: number; buildingDepth: number }) {
  const seed = (x: number, z: number) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1

  const tileSize = 4
  const gridRange = 20
  const halfBW = buildingWidth / 2 + 0.5
  const halfBD = buildingDepth / 2 + 0.5

  const { tiles, decorations } = useMemo(() => {
    const t: { pos: [number, number, number]; shade: number }[] = []
    const d: { type: 'tuft' | 'rock'; pos: [number, number, number]; scale?: number }[] = []

    for (let gx = -gridRange; gx <= gridRange; gx++) {
      for (let gz = -gridRange; gz <= gridRange; gz++) {
        const wx = gx * tileSize
        const wz = gz * tileSize
        // Skip tiles inside the building footprint
        if (Math.abs(wx) < halfBW && Math.abs(wz) < halfBD) continue

        const s = seed(gx, gz)
        t.push({ pos: [wx, -0.15, wz], shade: s })

        if (s > 0.75) {
          d.push({ type: 'tuft', pos: [wx + s * 1.5 - 0.75, -0.1, wz + (1 - s) * 1.5 - 0.75] })
        }
        if (s > 0.88) {
          d.push({ type: 'rock', pos: [wx + s * 2 - 1, -0.05, wz - s * 1.5 + 0.75], scale: 0.5 + s * 0.8 })
        }
      }
    }
    return { tiles: t, decorations: d }
  }, [halfBW, halfBD])

  return (
    <group>
      {tiles.map((tile, i) => (
        <GrassTile key={i} position={tile.pos} size={tileSize} shade={tile.shade} />
      ))}
      {decorations.map((dec, i) =>
        dec.type === 'tuft'
          ? <GrassTuft key={`d${i}`} position={dec.pos} />
          : <SmallRock key={`d${i}`} position={dec.pos} scale={dec.scale} />
      )}
    </group>
  )
}

// ─── Parking / Break Area ──────────────────────────────────────

function ParkingAreaFloor({ x, z, width, depth }: { x: number; z: number; width: number; depth: number }) {
  const floorToon = useToonMaterialProps('#BFB090')

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, z]} receiveShadow>
      <boxGeometry args={[width, depth, 0.12]} />
      <meshToonMaterial {...floorToon} />
    </mesh>
  )
}

// ─── Loading Fallback ──────────────────────────────────────────

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4f46e5" wireframe />
    </mesh>
  )
}

// ─── Scene Content ─────────────────────────────────────────────

// ─── Bot Placement Helpers ──────────────────────────────────────

/** Map agent status to BotStatus */
function agentStatusToBotStatus(agentStatus: string, session?: CrewSession): BotStatus {
  if (!session) return 'offline'
  const now = Date.now()
  const lastActivity = session.updatedAt || 0
  const timeSinceActivity = now - lastActivity

  // If no activity for 10+ minutes → sleeping
  if (timeSinceActivity > 10 * 60 * 1000) return 'sleeping'

  switch (agentStatus) {
    case 'working':
    case 'thinking':
      return 'active'
    case 'idle':
      return 'idle'
    case 'offline':
      return 'offline'
    default:
      return 'idle'
  }
}

/** Calculate positions for multiple bots inside a room, spaced evenly */
function getBotPositionsInRoom(
  roomPos: [number, number, number],
  roomSize: number,
  botCount: number,
): [number, number, number][] {
  const positions: [number, number, number][] = []
  const floorY = roomPos[1] + 0.16 // room floor surface
  const margin = 2.5 // stay away from walls and props

  if (botCount === 0) return positions

  if (botCount === 1) {
    // Center of room, slightly offset
    positions.push([roomPos[0], floorY, roomPos[2] + 0.5])
    return positions
  }

  // Spread bots in a grid pattern inside the room
  const availableWidth = roomSize - margin * 2
  const cols = Math.min(botCount, 3)
  const rows = Math.ceil(botCount / cols)
  const spacingX = availableWidth / (cols + 1)
  const spacingZ = availableWidth / (rows + 1)

  for (let i = 0; i < botCount; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = roomPos[0] - availableWidth / 2 + (col + 1) * spacingX
    const z = roomPos[2] - availableWidth / 2 + (row + 1) * spacingZ
    positions.push([x, floorY, z])
  }

  return positions
}

/** Calculate positions for bots in the parking area */
function getBotPositionsInParking(
  parkingX: number,
  parkingZ: number,
  parkingWidth: number,
  parkingDepth: number,
  botCount: number,
): [number, number, number][] {
  const positions: [number, number, number][] = []
  const floorY = 0.02 // parking floor level
  const margin = 2

  if (botCount === 0) return positions

  const availableWidth = parkingWidth - margin * 2
  const availableDepth = parkingDepth - margin * 2
  const cols = Math.min(botCount, 3)
  const rows = Math.ceil(botCount / cols)
  const spacingX = availableWidth / (cols + 1)
  const spacingZ = availableDepth / (rows + 1)

  for (let i = 0; i < botCount; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = parkingX - availableWidth / 2 + (col + 1) * spacingX
    const z = parkingZ - availableDepth / 2 + (row + 1) * spacingZ
    positions.push([x, floorY, z])
  }

  return positions
}

// ─── Bot data for placement ──────────────────────────────────────

interface BotPlacement {
  key: string
  session: CrewSession
  status: BotStatus
  config: ReturnType<typeof getBotConfigFromSession>
  name: string
  scale: number
}

function SceneContent({ sessions }: { sessions: CrewSession[] }) {
  const { rooms, getRoomForSession, isLoading } = useRooms()
  const { agents: agentRuntimes } = useAgentsRegistry(sessions)

  const layout = useMemo(() => {
    if (rooms.length === 0) return null
    return calculateBuildingLayout(rooms)
  }, [rooms])

  // ─── Bot placement logic ──────────────────────────────────────

  /** Build a BotPlacement from a session + optional agent runtime */
  const buildBotPlacement = (session: CrewSession, runtime?: AgentRuntime): BotPlacement => {
    const status = runtime
      ? agentStatusToBotStatus(runtime.status, session)
      : agentStatusToBotStatus('idle', session)
    const config = getBotConfigFromSession(
      session.key,
      session.label,
      runtime?.agent?.color
    )
    const name = getBotDisplayName(session.key, session.displayName, session.label)
    const scale = isSubagent(session.key) ? 1.0 : 1.8
    return { key: session.key, session, status, config, name, scale }
  }

  /** Map bots to rooms and parking */
  const { roomBots, parkingBots } = useMemo(() => {
    const roomBots = new Map<string, BotPlacement[]>()
    const parkingBots: BotPlacement[] = []

    // Initialize room bot arrays
    for (const room of rooms) {
      roomBots.set(room.id, [])
    }

    // Place agent runtimes (main agents + their child sessions)
    const placedKeys = new Set<string>()

    for (const runtime of agentRuntimes) {
      // Main agent session
      if (runtime.session) {
        const roomId = runtime.agent.default_room_id
          || getRoomForSession(runtime.session.key, {
            label: runtime.session.label,
            model: runtime.session.model,
            channel: runtime.session.channel,
          })
        const placement = buildBotPlacement(runtime.session, runtime)
        if (roomId && roomBots.has(roomId)) {
          roomBots.get(roomId)!.push(placement)
        } else {
          parkingBots.push(placement)
        }
        placedKeys.add(runtime.session.key)
      }

      // Child sessions (subagents)
      for (const child of runtime.childSessions) {
        if (placedKeys.has(child.key)) continue
        const roomId = getRoomForSession(child.key, {
          label: child.label,
          model: child.model,
          channel: child.channel,
        }) || runtime.agent.default_room_id

        const placement = buildBotPlacement(child)
        if (roomId && roomBots.has(roomId)) {
          roomBots.get(roomId)!.push(placement)
        } else {
          parkingBots.push(placement)
        }
        placedKeys.add(child.key)
      }
    }

    // Any remaining sessions not matched to agents
    for (const session of sessions) {
      if (placedKeys.has(session.key)) continue
      const roomId = getRoomForSession(session.key, {
        label: session.label,
        model: session.model,
        channel: session.channel,
      })
      const placement = buildBotPlacement(session)
      if (roomId && roomBots.has(roomId)) {
        roomBots.get(roomId)!.push(placement)
      } else {
        parkingBots.push(placement)
      }
      placedKeys.add(session.key)
    }

    return { roomBots, parkingBots }
  }, [sessions, rooms, agentRuntimes, getRoomForSession])

  if (isLoading || !layout) return null

  const { roomPositions, buildingWidth, buildingDepth, parkingArea, entranceX, cols, rows, gridOriginX, gridOriginZ } = layout

  return (
    <>
      {/* Exterior grass (outside building) */}
      <ExteriorGround buildingWidth={buildingWidth} buildingDepth={buildingDepth} />

      {/* Building floor slab */}
      <BuildingFloor width={buildingWidth} depth={buildingDepth} />

      {/* Outer perimeter walls */}
      <BuildingWalls
        width={buildingWidth}
        depth={buildingDepth}
        entranceWidth={5}
        entranceOffset={entranceX}
      />

      {/* Parking / Break area floor (slightly different shade) */}
      <ParkingAreaFloor
        x={parkingArea.x}
        z={parkingArea.z}
        width={parkingArea.width}
        depth={parkingArea.depth}
      />

      {/* Parking / Break area with props */}
      <ParkingArea3D
        position={[parkingArea.x, 0, parkingArea.z]}
        width={parkingArea.width}
        depth={parkingArea.depth}
      />

      {/* Hallway floor lines (subtle center dashes) */}
      <HallwayFloorLines
        roomSize={ROOM_SIZE}
        hallwayWidth={HALLWAY_WIDTH}
        cols={cols}
        rows={rows}
        gridOriginX={gridOriginX}
        gridOriginZ={gridOriginZ}
      />

      {/* Entrance lobby area (front wall is at -Z) */}
      <EntranceLobby
        entranceX={entranceX}
        buildingFrontZ={-buildingDepth / 2}
        entranceWidth={5}
      />

      {/* Hallway decorations */}
      <Hallway
        roomPositions={roomPositions}
        roomSize={ROOM_SIZE}
        hallwayWidth={HALLWAY_WIDTH}
        cols={cols}
        rows={rows}
        gridOriginX={gridOriginX}
        gridOriginZ={gridOriginZ}
      />

      {/* Rooms in grid layout */}
      {roomPositions.map(({ room, position }) => {
        const botsInRoom = roomBots.get(room.id) || []
        const botPositions = getBotPositionsInRoom(position, ROOM_SIZE, botsInRoom.length)

        return (
          <group key={room.id}>
            <Room3D
              room={room}
              position={position}
              size={ROOM_SIZE}
            />
            {/* Bots inside this room */}
            {botsInRoom.map((bot, i) => (
              <Bot3D
                key={bot.key}
                position={botPositions[i] || position}
                config={bot.config}
                status={bot.status}
                name={bot.name}
                scale={bot.scale}
              />
            ))}
          </group>
        )
      })}

      {/* Parking area bots */}
      {parkingBots.length > 0 && (() => {
        const positions = getBotPositionsInParking(
          parkingArea.x, parkingArea.z,
          parkingArea.width, parkingArea.depth,
          parkingBots.length,
        )
        return parkingBots.map((bot, i) => (
          <Bot3D
            key={bot.key}
            position={positions[i] || [parkingArea.x, 0.02, parkingArea.z]}
            config={bot.config}
            status={bot.status}
            name={bot.name}
            scale={bot.scale}
          />
        ))
      })()}
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────

/**
 * Main 3D World view — Office Building layout.
 * Rooms arranged in a grid with hallways, surrounded by outer walls,
 * with a parking/break area and grass exterior.
 */
export function World3DView({ sessions, settings: _settings, onAliasChanged: _onAliasChanged }: World3DViewProps) {
  void _settings
  void _onAliasChanged

  return (
    <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
      <Canvas
        shadows
        camera={{
          position: [45, 40, 45],
          fov: 40,
          near: 0.1,
          far: 300,
        }}
        style={{
          background: 'linear-gradient(180deg, #87CEEB 0%, #C9E8F5 40%, #E8F0E8 100%)',
        }}
      >
        <Suspense fallback={<LoadingFallback />}>
          <WorldLighting />
          <SceneContent sessions={sessions} />
          <OrbitControls
            makeDefault
            enablePan
            enableZoom
            enableRotate
            minDistance={15}
            maxDistance={120}
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
          🏢 CrewHub Office
        </div>
      </div>
    </div>
  )
}

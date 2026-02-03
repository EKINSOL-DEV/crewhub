import { Suspense, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { WorldLighting } from './WorldLighting'
import { BuildingFloor } from './BuildingFloor'
import { BuildingWalls } from './BuildingWalls'
import { Hallway } from './Hallway'
import { HallwayFloorLines } from './HallwayFloorLines'
import { EntranceLobby } from './EntranceLobby'
import { ParkingArea3D } from './ParkingArea3D'
import { Room3D } from './Room3D'
import { Bot3D, type BotStatus } from './Bot3D'
import { BotInfoPanel } from './BotInfoPanel'
import { useRooms } from '@/hooks/useRooms'
import { useAgentsRegistry, type AgentRuntime } from '@/hooks/useAgentsRegistry'
import { useSessionActivity } from '@/hooks/useSessionActivity'
import { useSessionDisplayNames } from '@/hooks/useSessionDisplayNames'
import { useToonMaterialProps } from './utils/toonMaterials'
import { getBotConfigFromSession, isSubagent } from './utils/botVariants'
import { getSessionDisplayName } from '@/lib/minionUtils'
import { getDefaultRoomForSession } from '@/lib/roomsConfig'
import { splitSessionsForDisplay } from '@/lib/sessionFiltering'
import { CameraController } from './CameraController'
import { RoomTabsBar } from './RoomTabsBar'
import { WorldNavigation } from './WorldNavigation'
import { WorldFocusProvider, useWorldFocus, type FocusLevel } from '@/contexts/WorldFocusContext'
import { DragDropProvider } from '@/contexts/DragDropContext'
import { useChatContext } from '@/contexts/ChatContext'
import { LogViewer } from '@/components/sessions/LogViewer'
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
const MAX_VISIBLE_BOTS_PER_ROOM = 8 // limit rendered bots; remainder shown as "+N more"
const PARKING_WIDTH = 9 // width of parking/break area (compact break room)
const PARKING_DEPTH_MIN = ROOM_SIZE // minimum depth (≈ 1 room tall)

// ─── Building Layout Calculation ───────────────────────────────
interface BuildingLayout {
  roomPositions: { room: ReturnType<typeof useRooms>['rooms'][0]; position: [number, number, number] }[]
  buildingWidth: number
  buildingDepth: number
  parkingArea: { x: number; z: number; width: number; depth: number }
  entranceX: number
  cols: number
  rows: number
  gridOriginX: number
  gridOriginZ: number
}

function calculateBuildingLayout(rooms: ReturnType<typeof useRooms>['rooms']): BuildingLayout {
  const sorted = [...rooms].sort((a, b) => a.sort_order - b.sort_order)
  const roomCount = sorted.length
  const cols = Math.min(roomCount, MAX_COLS)
  const rows = Math.ceil(roomCount / cols)

  const gridWidth = cols * ROOM_SIZE + (cols - 1) * HALLWAY_WIDTH
  const gridDepth = rows * ROOM_SIZE + (rows - 1) * HALLWAY_WIDTH

  const buildingWidth = BUILDING_PADDING * 2 + gridWidth + HALLWAY_WIDTH + PARKING_WIDTH
  const parkingDepth = Math.min(Math.max(PARKING_DEPTH_MIN, ROOM_SIZE * 2), gridDepth)
  const buildingDepth = BUILDING_PADDING * 2 + gridDepth

  const gridOriginX = -buildingWidth / 2 + BUILDING_PADDING + ROOM_SIZE / 2
  const gridOriginZ = -buildingDepth / 2 + BUILDING_PADDING + ROOM_SIZE / 2

  const roomPositions = sorted.map((room, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const x = gridOriginX + col * GRID_SPACING
    const z = gridOriginZ + row * GRID_SPACING
    return { room, position: [x, 0, z] as [number, number, number] }
  })

  const parkingX = gridOriginX + cols * GRID_SPACING + HALLWAY_WIDTH / 2 + PARKING_WIDTH / 2 - ROOM_SIZE / 2
  const parkingZ = gridOriginZ + parkingDepth / 2 - ROOM_SIZE / 2
  const parkingArea = { x: parkingX, z: parkingZ, width: PARKING_WIDTH, depth: parkingDepth }

  const entranceX = gridOriginX + ((cols - 1) * GRID_SPACING) / 2

  return { roomPositions, buildingWidth, buildingDepth, parkingArea, entranceX, cols, rows, gridOriginX, gridOriginZ }
}

// ─── Grass Ground (outside building) ───────────────────────────

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

function SmallRock({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const toonProps = useToonMaterialProps('#9E9684')
  return (
    <mesh position={position} scale={scale} castShadow>
      <dodecahedronGeometry args={[0.2, 0]} />
      <meshToonMaterial {...toonProps} />
    </mesh>
  )
}

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
        if (Math.abs(wx) < halfBW && Math.abs(wz) < halfBD) continue
        const s = seed(gx, gz)
        t.push({ pos: [wx, -0.15, wz], shade: s })
        if (s > 0.75) d.push({ type: 'tuft', pos: [wx + s * 1.5 - 0.75, -0.1, wz + (1 - s) * 1.5 - 0.75] })
        if (s > 0.88) d.push({ type: 'rock', pos: [wx + s * 2 - 1, -0.05, wz - s * 1.5 + 0.75], scale: 0.5 + s * 0.8 })
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

// ─── Bot Status (accurate, matching 2D) ────────────────────────

function getAccurateBotStatus(session: CrewSession, isActive: boolean): BotStatus {
  if (isActive) return 'active'
  const idleSeconds = (Date.now() - session.updatedAt) / 1000
  if (idleSeconds < 120) return 'idle'
  if (idleSeconds < 1800) return 'sleeping'  // 30 min before offline (was 10 min)
  return 'offline'
}

// ─── Activity Text for Bubbles ──────────────────────────────────

function getActivityText(session: CrewSession, isActive: boolean): string {
  if (isActive) {
    // Prefer session label (e.g. "review-chat-design")
    if (session.label) return session.label
    // Check last tool call from messages
    if (session.messages && session.messages.length > 0) {
      const recentMessages = session.messages.slice(-3)
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i]
        if (Array.isArray(msg.content)) {
          for (const block of msg.content) {
            if ((block.type === 'toolCall' || block.type === 'tool_use') && block.name) {
              return `🔧 ${block.name}`
            }
            if (block.type === 'thinking') {
              return '💭 Thinking...'
            }
          }
        }
      }
    }
    return 'Working...'
  }
  // Idle
  return '💤 Idle'
}

// ─── Bot Placement Helpers ──────────────────────────────────────

function getBotPositionsInRoom(
  roomPos: [number, number, number],
  roomSize: number,
  botCount: number,
): [number, number, number][] {
  const positions: [number, number, number][] = []
  const floorY = roomPos[1] + 0.16
  const margin = 2.5

  if (botCount === 0) return positions
  if (botCount === 1) {
    positions.push([roomPos[0], floorY, roomPos[2] + 0.5])
    return positions
  }

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

function getBotPositionsInParking(
  parkingX: number,
  parkingZ: number,
  parkingWidth: number,
  parkingDepth: number,
  botCount: number,
): [number, number, number][] {
  const positions: [number, number, number][] = []
  const floorY = 0.02
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
  activity: string
  isActive: boolean
}

// ─── Room bounds for wandering ──────────────────────────────────

export interface RoomBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

function getRoomBounds(roomPos: [number, number, number], roomSize: number): RoomBounds {
  const margin = 2.5
  return {
    minX: roomPos[0] - roomSize / 2 + margin,
    maxX: roomPos[0] + roomSize / 2 - margin,
    minZ: roomPos[2] - roomSize / 2 + margin,
    maxZ: roomPos[2] + roomSize / 2 - margin,
  }
}

function getParkingBounds(x: number, z: number, width: number, depth: number): RoomBounds {
  const margin = 2
  return {
    minX: x - width / 2 + margin,
    maxX: x + width / 2 - margin,
    minZ: z - depth / 2 + margin,
    maxZ: z + depth / 2 - margin,
  }
}

// ─── Scene Content Props ────────────────────────────────────────

interface SceneContentProps {
  visibleSessions: CrewSession[]
  parkingSessions: CrewSession[]
  settings: SessionsSettings
  isActivelyRunning: (key: string) => boolean
  displayNames: Map<string, string | null>
  onBotClick?: (session: CrewSession) => void
  focusLevel: FocusLevel
  focusedRoomId: string | null
  focusedBotKey: string | null
}

// ─── Scene Content ─────────────────────────────────────────────

function SceneContent({
  visibleSessions,
  parkingSessions,
  settings: _settings,
  isActivelyRunning,
  displayNames,
  onBotClick,
  focusLevel,
  focusedRoomId,
  focusedBotKey,
}: SceneContentProps) {
  void _settings // Available for future use (e.g. animation speed)
  // Combine all sessions for agent registry lookup
  const allSessions = useMemo(
    () => [...visibleSessions, ...parkingSessions],
    [visibleSessions, parkingSessions],
  )
  const { rooms, getRoomForSession, isLoading } = useRooms()
  const { agents: agentRuntimes } = useAgentsRegistry(allSessions)

  const layout = useMemo(() => {
    if (rooms.length === 0) return null
    return calculateBuildingLayout(rooms)
  }, [rooms])

  // ─── Bot placement logic ──────────────────────────────────────

  const buildBotPlacement = (session: CrewSession, _runtime?: AgentRuntime): BotPlacement => {
    const isActive = isActivelyRunning(session.key)
    const status = getAccurateBotStatus(session, isActive)
    const config = getBotConfigFromSession(session.key, session.label, _runtime?.agent?.color)
    const name = getSessionDisplayName(session, displayNames.get(session.key))
    const scale = isSubagent(session.key) ? 0.6 : 1.0
    const activity = getActivityText(session, isActive)
    return { key: session.key, session, status, config, name, scale, activity, isActive }
  }

  /** Map visible bots to rooms */
  const { roomBots, parkingBots } = useMemo(() => {
    const roomBots = new Map<string, BotPlacement[]>()
    const parkingBots: BotPlacement[] = []

    for (const room of rooms) {
      roomBots.set(room.id, [])
    }

    // Place agent runtimes (main agents + child sessions) — only from visible sessions
    const placedKeys = new Set<string>()
    const visibleKeys = new Set(visibleSessions.map(s => s.key))

    for (const runtime of agentRuntimes) {
      // Main agent session
      if (runtime.session && visibleKeys.has(runtime.session.key)) {
        const roomId = runtime.agent.default_room_id
          || getRoomForSession(runtime.session.key, {
            label: runtime.session.label,
            model: runtime.session.model,
            channel: runtime.session.lastChannel || runtime.session.channel,
          })
          || getDefaultRoomForSession(runtime.session.key)
          || rooms[0]?.id || 'headquarters'
        const placement = buildBotPlacement(runtime.session, runtime)
        if (roomBots.has(roomId)) {
          roomBots.get(roomId)!.push(placement)
        } else {
          // Room doesn't exist, fallback
          const fallback = rooms[0]?.id || 'headquarters'
          if (roomBots.has(fallback)) roomBots.get(fallback)!.push(placement)
        }
        placedKeys.add(runtime.session.key)
      }

      // Child sessions (subagents) — only from visible sessions
      for (const child of runtime.childSessions) {
        if (placedKeys.has(child.key) || !visibleKeys.has(child.key)) continue
        const roomId = getRoomForSession(child.key, {
          label: child.label,
          model: child.model,
          channel: child.lastChannel || child.channel,
        })
          || getDefaultRoomForSession(child.key)
          || runtime.agent.default_room_id
          || rooms[0]?.id || 'headquarters'

        const placement = buildBotPlacement(child)
        if (roomBots.has(roomId)) {
          roomBots.get(roomId)!.push(placement)
        } else {
          const fallback = rooms[0]?.id || 'headquarters'
          if (roomBots.has(fallback)) roomBots.get(fallback)!.push(placement)
        }
        placedKeys.add(child.key)
      }
    }

    // Remaining visible sessions not matched to agents
    for (const session of visibleSessions) {
      if (placedKeys.has(session.key)) continue
      const roomId = getRoomForSession(session.key, {
        label: session.label,
        model: session.model,
        channel: session.lastChannel || session.channel,
      })
        || getDefaultRoomForSession(session.key)
        || rooms[0]?.id || 'headquarters'

      const placement = buildBotPlacement(session)
      if (roomBots.has(roomId)) {
        roomBots.get(roomId)!.push(placement)
      } else {
        const fallback = rooms[0]?.id || 'headquarters'
        if (roomBots.has(fallback)) roomBots.get(fallback)!.push(placement)
      }
      placedKeys.add(session.key)
    }

    // Parking sessions
    for (const session of parkingSessions) {
      parkingBots.push(buildBotPlacement(session))
    }

    return { roomBots, parkingBots }
  }, [visibleSessions, parkingSessions, rooms, agentRuntimes, getRoomForSession, isActivelyRunning, displayNames])

  // Build room positions for CameraController (MUST be before early return to respect hooks rules)
  const cameraRoomPositions = useMemo(
    () => layout?.roomPositions.map(rp => ({ roomId: rp.room.id, position: rp.position })) ?? [],
    [layout],
  )

  // Helper: should a bot show its label based on focus level?
  const shouldShowLabel = (botStatus: BotStatus, botRoomId: string): boolean => {
    if (focusLevel === 'overview') {
      return botStatus === 'active' // only active bots in overview
    }
    return focusedRoomId === botRoomId // all bots in focused room
  }

  // Helper: should a bot show its activity bubble based on focus level?
  const shouldShowActivity = (botStatus: BotStatus, botRoomId: string, botKey: string): boolean => {
    // Never show for sleeping/offline
    if (botStatus === 'sleeping' || botStatus === 'offline') return false
    // Bot focus: always show for focused bot
    if (focusLevel === 'bot' && focusedBotKey === botKey) return true
    // Overview: only active bots
    if (focusLevel === 'overview') return botStatus === 'active'
    // Room focus: all bots in focused room + active bots elsewhere
    return focusedRoomId === botRoomId || botStatus === 'active'
  }

  if (isLoading || !layout) return null

  const { roomPositions, buildingWidth, buildingDepth, parkingArea, entranceX, cols, rows, gridOriginX, gridOriginZ } = layout

  return (
    <>
      <ExteriorGround buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
      <BuildingFloor width={buildingWidth} depth={buildingDepth} />
      <BuildingWalls width={buildingWidth} depth={buildingDepth} entranceWidth={5} entranceOffset={entranceX} />
      <ParkingAreaFloor x={parkingArea.x} z={parkingArea.z} width={parkingArea.width} depth={parkingArea.depth} />
      <ParkingArea3D position={[parkingArea.x, 0, parkingArea.z]} width={parkingArea.width} depth={parkingArea.depth} />
      <HallwayFloorLines roomSize={ROOM_SIZE} hallwayWidth={HALLWAY_WIDTH} cols={cols} rows={rows} gridOriginX={gridOriginX} gridOriginZ={gridOriginZ} />
      <EntranceLobby entranceX={entranceX} buildingFrontZ={-buildingDepth / 2} entranceWidth={5} />
      <Hallway roomPositions={roomPositions} roomSize={ROOM_SIZE} hallwayWidth={HALLWAY_WIDTH} cols={cols} rows={rows} gridOriginX={gridOriginX} gridOriginZ={gridOriginZ} />

      {/* CameraController (inside Canvas, manages camera animation + constraints) */}
      <CameraController roomPositions={cameraRoomPositions} />

      {/* Rooms in grid layout */}
      {roomPositions.map(({ room, position }) => {
        const botsInRoom = roomBots.get(room.id) || []
        const visibleBots = botsInRoom.slice(0, MAX_VISIBLE_BOTS_PER_ROOM)
        const overflowCount = botsInRoom.length - visibleBots.length
        const botPositions = getBotPositionsInRoom(position, ROOM_SIZE, visibleBots.length)
        const bounds = getRoomBounds(position, ROOM_SIZE)

        return (
          <group key={room.id}>
            <Room3D room={room} position={position} size={ROOM_SIZE} />
            {visibleBots.map((bot, i) => (
              <Bot3D
                key={bot.key}
                position={botPositions[i] || position}
                config={bot.config}
                status={bot.status}
                name={bot.name}
                scale={bot.scale}
                session={bot.session}
                onClick={onBotClick}
                roomBounds={bounds}
                showLabel={shouldShowLabel(bot.status, room.id)}
                showActivity={shouldShowActivity(bot.status, room.id, bot.key)}
                activity={bot.activity}
                isActive={bot.isActive}
                roomId={room.id}
              />
            ))}
            {overflowCount > 0 && (
              <Html
                position={[position[0] + ROOM_SIZE / 2 - 1.5, 1.2, position[2] + ROOM_SIZE / 2 - 1]}
                center
                distanceFactor={15}
                zIndexRange={[1, 5]}
                style={{ pointerEvents: 'none' }}
              >
                <div style={{
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  padding: '3px 8px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  fontFamily: 'system-ui, sans-serif',
                }}>
                  +{overflowCount} more
                </div>
              </Html>
            )}
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
        const bounds = getParkingBounds(parkingArea.x, parkingArea.z, parkingArea.width, parkingArea.depth)
        return parkingBots.map((bot, i) => (
          <Bot3D
            key={bot.key}
            position={positions[i] || [parkingArea.x, 0.02, parkingArea.z]}
            config={bot.config}
            status={bot.status}
            name={bot.name}
            scale={bot.scale}
            session={bot.session}
            onClick={onBotClick}
            roomBounds={bounds}
            showLabel={focusLevel === 'overview' ? bot.status === 'active' : false}
            showActivity={shouldShowActivity(bot.status, 'parking', bot.key)}
            activity={bot.activity}
            isActive={bot.isActive}
            roomId="parking"
          />
        ))
      })()}
    </>
  )
}

// ─── Main Component ────────────────────────────────────────────

function World3DViewInner({ sessions, settings, onAliasChanged: _onAliasChanged }: World3DViewProps) {
  // Shared hooks for activity tracking and session filtering
  const { isActivelyRunning } = useSessionActivity(sessions)
  const idleThreshold = settings.parkingIdleThreshold ?? 120
  const { visibleSessions, parkingSessions } = splitSessionsForDisplay(
    sessions, isActivelyRunning, idleThreshold,
  )

  // Display names
  const sessionKeys = useMemo(() => sessions.map(s => s.key), [sessions])
  const { displayNames } = useSessionDisplayNames(sessionKeys)

  // Focus state
  const { state: focusState, focusBot, goBack } = useWorldFocus()

  // Chat context — register focus handler for 3D view
  const { setFocusHandler } = useChatContext()

  // Rooms for overlays (tabs bar, navigation)
  const { rooms, getRoomForSession, refresh: refreshRooms } = useRooms()

  // Register 3D focus handler: zoom to bot when 🎯 is clicked in chat panel
  const handleFocusAgent = useCallback((sessionKey: string) => {
    // Find the session to determine its room
    const session = [...visibleSessions, ...parkingSessions].find(s => s.key === sessionKey)
    if (!session) return

    // Determine room using same logic as SceneContent
    const roomId = getRoomForSession(session.key, {
      label: session.label,
      model: session.model,
      channel: session.lastChannel || session.channel,
    })
      || getDefaultRoomForSession(session.key)
      || rooms[0]?.id
      || 'headquarters'

    focusBot(sessionKey, roomId)
  }, [visibleSessions, parkingSessions, getRoomForSession, rooms, focusBot])

  useEffect(() => {
    setFocusHandler(handleFocusAgent)
    return () => setFocusHandler(null)
  }, [setFocusHandler, handleFocusAgent])

  // Calculate room bot counts for tabs bar
  const roomBotCounts = useMemo(() => {
    const counts = new Map<string, number>()
    // Simple counting — could reuse roomBots from SceneContent, but this is lightweight
    for (const session of visibleSessions) {
      // Just count all visible sessions per room for now
      // The detailed placement happens inside SceneContent
      void session
    }
    return counts
  }, [visibleSessions])

  // LogViewer state
  const [selectedSession, setSelectedSession] = useState<CrewSession | null>(null)
  const [logViewerOpen, setLogViewerOpen] = useState(false)

  // Bot click no longer opens LogViewer directly — focusBot is triggered inside Bot3D
  const handleBotClick = (_session: CrewSession) => {
    // Intentionally empty: Bot3D now calls focusBot() directly via context.
    // LogViewer is opened from BotInfoPanel's "Open Full Log" button.
    void _session
  }

  // Find session by key for BotInfoPanel
  const allSessions = useMemo(
    () => [...visibleSessions, ...parkingSessions],
    [visibleSessions, parkingSessions],
  )

  const focusedSession = useMemo(() => {
    if (!focusState.focusedBotKey) return null
    return allSessions.find(s => s.key === focusState.focusedBotKey) ?? null
  }, [focusState.focusedBotKey, allSessions])

  const focusedBotConfig = useMemo(() => {
    if (!focusedSession) return null
    return getBotConfigFromSession(focusedSession.key, focusedSession.label)
  }, [focusedSession])

  const focusedBotStatus: BotStatus = useMemo(() => {
    if (!focusedSession) return 'offline'
    return getAccurateBotStatus(focusedSession, isActivelyRunning(focusedSession.key))
  }, [focusedSession, isActivelyRunning])

  return (
    <DragDropProvider onAssignmentChanged={refreshRooms}>
      <div className="relative w-full h-full" style={{ minHeight: '600px' }}>
        <Canvas
          shadows
          camera={{ position: [45, 40, 45], fov: 40, near: 0.1, far: 300 }}
          style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #C9E8F5 40%, #E8F0E8 100%)' }}
        >
          <Suspense fallback={<LoadingFallback />}>
            <WorldLighting />
            <SceneContent
              visibleSessions={visibleSessions}
              parkingSessions={parkingSessions}
              settings={settings}
              isActivelyRunning={isActivelyRunning}
              displayNames={displayNames}
              onBotClick={handleBotClick}
              focusLevel={focusState.level}
              focusedRoomId={focusState.focusedRoomId}
              focusedBotKey={focusState.focusedBotKey}
            />
          </Suspense>
        </Canvas>

        {/* Back button / navigation (top-left) */}
        <WorldNavigation rooms={rooms} />

        {/* Overlay controls hint (hide when bot panel is showing) */}
        {focusState.level !== 'bot' && (
          <div className="absolute top-4 right-4 z-50">
            <div className="text-xs px-3 py-1.5 rounded-lg backdrop-blur-md text-gray-700 bg-white/60 border border-gray-200/50 shadow-sm">
              🖱️ Drag: Rotate · Scroll: Zoom · Right-drag: Pan
            </div>
          </div>
        )}

        {/* Bot Info Panel (slides in when bot is focused) */}
        {focusState.level === 'bot' && focusState.focusedBotKey && focusedSession && focusedBotConfig && (
          <BotInfoPanel
            session={focusedSession}
            displayName={displayNames.get(focusState.focusedBotKey) || getSessionDisplayName(focusedSession, null)}
            botConfig={focusedBotConfig}
            status={focusedBotStatus}
            onClose={() => goBack()}
            onOpenLog={(session) => {
              setSelectedSession(session)
              setLogViewerOpen(true)
            }}
          />
        )}

        {/* Room tabs bar (bottom) */}
        <RoomTabsBar
          rooms={rooms}
          roomBotCounts={roomBotCounts}
          parkingBotCount={parkingSessions.length}
        />

        {/* LogViewer (outside Canvas) */}
        <LogViewer session={selectedSession} open={logViewerOpen} onOpenChange={setLogViewerOpen} />
      </div>
    </DragDropProvider>
  )
}

export function World3DView(props: World3DViewProps) {
  return (
    <WorldFocusProvider>
      <World3DViewInner {...props} />
    </WorldFocusProvider>
  )
}

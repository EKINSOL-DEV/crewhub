/**
 * SceneContent — R3F scene graph rendered inside <Canvas>.
 * Receives all data as props (no fetch/SSE hooks inside Canvas).
 */
import { useMemo, useEffect } from 'react'
import { Html } from '@react-three/drei'
import { WorldLighting } from './WorldLighting'
import { BuildingFloor } from './BuildingFloor'
import { BuildingWalls } from './BuildingWalls'
import { Hallway } from './Hallway'
import { HallwayFloorLines } from './HallwayFloorLines'
import { ParkingArea3D } from './ParkingArea3D'
import { WanderingBots3D, type RoomObstacle } from './WanderingBots3D'
import { Room3D } from './Room3D'
import { Bot3D } from './Bot3D'
import type { BotStatus } from './botConstants'
import { useAgentsRegistry, type AgentRuntime } from '@/hooks/useAgentsRegistry'
import { getToonMaterialProps } from './utils/toonMaterials'
import { EnvironmentSwitcher } from './environments'
import { getBotConfigFromSession, isSubagent } from './utils/botVariants'
import { getSessionDisplayName } from '@/lib/minionUtils'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { CameraController } from './CameraController'
import { FirstPersonController } from './FirstPersonController'
import { CameraDebugTracker } from './CameraDebugOverlay'
import { meetingGatheringState } from '@/lib/meetingStore'
import {
  calculateBuildingLayout,
  getRoomBounds,
  getParkingBounds,
  ROOM_SIZE,
  HALLWAY_WIDTH,
} from './utils/buildingLayout'
import { getAccurateBotStatus, getActivityText } from './utils/botActivity'
import { getBotPositionsInRoom, getBotPositionsInParking } from './utils/botPositions'
import type { RoomBounds } from './utils/buildingLayout'
import type { Room } from '@/hooks/useRooms'
import type { CrewSession } from '@/lib/api'
import type { SessionsSettings } from '@/components/sessions/SettingsPanel'
import type { FocusLevel } from '@/contexts/WorldFocusContext'
import type { PlacedProp } from '@/contexts/CreatorModeContext'
import { PlacedPropsRenderer } from './creator/PlacedPropsRenderer'
import { PlacementGhost } from './creator/PlacementGhost'
import { PlacementClickPlane } from './creator/PlacementClickPlane'

// ─── Types ──────────────────────────────────────────────────────

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

export interface SceneContentProps {
  readonly visibleSessions: CrewSession[]
  readonly parkingSessions: CrewSession[]
  readonly settings: SessionsSettings
  readonly isActivelyRunning: (key: string) => boolean
  readonly displayNames: Map<string, string | null>
  readonly onBotClick?: (session: CrewSession) => void
  readonly focusLevel: FocusLevel
  readonly focusedRoomId: string | null
  readonly focusedBotKey: string | null
  readonly onEnterRoom?: (roomName: string) => void
  readonly onLeaveRoom?: () => void
  /** Debug bot room overrides: session key → room ID */
  readonly debugRoomMap?: Map<string, string>
  /** Rooms data passed from outside Canvas (hooks don't work reliably inside R3F Canvas) */
  readonly rooms: Room[]
  readonly getRoomForSession: (
    sessionKey: string,
    sessionData?: { label?: string; model?: string; channel?: string }
  ) => string | undefined
  readonly isRoomsLoading: boolean
  /** Session keys of bots currently in an active meeting */
  readonly meetingParticipantKeys?: Set<string>
  readonly gridDebugEnabled: boolean
  /** Creator Mode: placed props to render in world */
  readonly placedProps?: PlacedProp[]
  /** Creator Mode: prop currently selected for placement */
  readonly selectedPropId?: string | null
  /** Creator Mode: pending rotation for ghost prop */
  readonly pendingRotation?: number
  /** Creator Mode: handler for placement click */
  readonly onPlaceProp?: (pos: { x: number; y: number; z: number }) => void
  /** Creator Mode: ghost position callback */
  readonly onGhostPosition?: (pos: { x: number; y: number; z: number } | null) => void
}

// ─── Parking Floor ──────────────────────────────────────────────

function ParkingAreaFloor({
  x,
  z,
  width,
  depth,
}: {
  readonly x: number
  readonly z: number
  readonly width: number
  readonly depth: number
}) {
  const floorToon = getToonMaterialProps('#BFB090')
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.08, z]} receiveShadow>
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

// ─── SceneContent ──────────────────────────────────────────────

export function SceneContent({
  visibleSessions,
  parkingSessions,
  settings: _settings,
  isActivelyRunning,
  displayNames,
  onBotClick,
  focusLevel,
  focusedRoomId,
  focusedBotKey,
  onEnterRoom,
  onLeaveRoom,
  debugRoomMap,
  rooms,
  getRoomForSession,
  isRoomsLoading,
  meetingParticipantKeys,
  gridDebugEnabled,
  placedProps = [],
  selectedPropId = null,
  pendingRotation = 0,
  onPlaceProp,
  onGhostPosition,
}: SceneContentProps) {
  const allSessions = useMemo(
    () => [...visibleSessions, ...parkingSessions],
    [visibleSessions, parkingSessions]
  )
  const { agents: agentRuntimes } = useAgentsRegistry(allSessions)

  const layout = useMemo(() => {
    if (rooms.length === 0) return null
    return calculateBuildingLayout(rooms)
  }, [rooms])

  const roomBoundsMap = useMemo(() => {
    if (!layout) return new Map<string, RoomBounds>()
    const map = new Map<string, RoomBounds>()
    for (const { room, position, size } of layout.roomPositions) {
      map.set(room.id, getRoomBounds(position, size))
    }
    return map
  }, [layout])

  const parkingBoundsStable = useMemo(() => {
    if (!layout) return undefined
    const { parkingArea } = layout
    return getParkingBounds(parkingArea.x, parkingArea.z, parkingArea.width, parkingArea.depth)
  }, [layout])

  const roomObstacles = useMemo<RoomObstacle[]>(() => {
    if (!layout) return []
    const obstacles: RoomObstacle[] = layout.roomPositions.map(({ position, size }) => ({
      cx: position[0],
      cz: position[2],
      halfW: size / 2,
      halfD: size / 2,
    }))
    obstacles.push({
      cx: layout.parkingArea.x,
      cz: layout.parkingArea.z,
      halfW: layout.parkingArea.width / 2,
      halfD: layout.parkingArea.depth / 2,
    })
    return obstacles
  }, [layout])

  // ─── Bot placement logic ──────────────────────────────────────

  const buildBotPlacement = (session: CrewSession, _runtime?: AgentRuntime): BotPlacement => {
    const isActive = isActivelyRunning(session.key)
    const baseStatus = getAccurateBotStatus(session, isActive, allSessions)
    const status: BotStatus = meetingParticipantKeys?.has(session.key) ? 'meeting' : baseStatus
    const config = getBotConfigFromSession(session.key, session.label, _runtime?.agent?.color)
    const name = getSessionDisplayName(session, displayNames.get(session.key))
    const scale = isSubagent(session.key) ? 0.6 : 1
    const activity = getActivityText(session, isActive, allSessions)
    return { key: session.key, session, status, config, name, scale, activity, isActive }
  }

  const { roomBots, parkingBots } = useMemo(() => {
    const roomBots = new Map<string, BotPlacement[]>()
    const parkingBots: BotPlacement[] = []
    for (const room of rooms) roomBots.set(room.id, [])

    const placedKeys = new Set<string>()
    const visibleKeys = new Set(visibleSessions.map((s) => s.key))
    const fallbackRoom = rooms[0]?.id || 'headquarters'

    const placeBot = (session: CrewSession, roomId: string, placement: BotPlacement) => {
      const target = roomBots.has(roomId) ? roomId : fallbackRoom
      const targetList = roomBots.get(target)
      if (targetList) targetList.push(placement)
      else roomBots.get(fallbackRoom)?.push(placement)
      placedKeys.add(session.key)
    }

    const resolveRoom = (session: CrewSession, defaultRoom?: string | null): string =>
      getRoomForSession(session.key, {
        label: session.label,
        model: session.model,
        channel: session.lastChannel || session.channel,
      }) ||
      defaultRoom ||
      fallbackRoom

    for (const runtime of agentRuntimes) {
      if (runtime.session && visibleKeys.has(runtime.session.key)) {
        placeBot(
          runtime.session,
          resolveRoom(runtime.session, runtime.agent.default_room_id),
          buildBotPlacement(runtime.session, runtime)
        )
      }
      for (const child of runtime.childSessions) {
        if (!placedKeys.has(child.key) && visibleKeys.has(child.key)) {
          placeBot(
            child,
            resolveRoom(child, runtime.agent.default_room_id),
            buildBotPlacement(child)
          )
        }
      }
    }

    for (const session of visibleSessions) {
      if (placedKeys.has(session.key)) continue
      const roomId = debugRoomMap?.get(session.key) || resolveRoom(session)
      placeBot(session, roomId, buildBotPlacement(session))
    }

    for (const session of parkingSessions) parkingBots.push(buildBotPlacement(session))

    return { roomBots, parkingBots }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visibleSessions,
    parkingSessions,
    rooms,
    agentRuntimes,
    getRoomForSession,
    isActivelyRunning,
    displayNames,
    debugRoomMap,
  ])

  // ─── Populate meeting store with room layout for pathfinding ──
  useEffect(() => {
    if (!layout) return
    const roomPosMap = new Map<string, { x: number; z: number; doorX: number; doorZ: number }>()
    for (const { room, position, size } of layout.roomPositions) {
      roomPosMap.set(room.id, {
        x: position[0],
        z: position[2],
        doorX: position[0],
        doorZ: position[2] - size / 2,
      })
    }
    meetingGatheringState.roomPositions = roomPosMap
    meetingGatheringState.roomSize = ROOM_SIZE

    const agentRooms = new Map<string, string>()
    for (const [roomId, bots] of roomBots) {
      for (const bot of bots) {
        agentRooms.set(bot.key, roomId)
      }
    }
    meetingGatheringState.agentRooms = agentRooms
  }, [layout, roomBots])

  const cameraRoomPositions = useMemo(
    () =>
      layout?.roomPositions.map((rp) => ({
        roomId: rp.room.id,
        position: rp.position,
        size: rp.size,
      })) ?? [],
    [layout]
  )

  const shouldShowLabel = (botStatus: BotStatus, botRoomId: string): boolean => {
    if (focusLevel === 'overview') return botStatus === 'active' || botStatus === 'supervising'
    return focusedRoomId === botRoomId
  }

  const shouldShowActivity = (botStatus: BotStatus, botRoomId: string, botKey: string): boolean => {
    if (botStatus === 'sleeping' || botStatus === 'offline') return false
    if (focusLevel === 'bot' && focusedBotKey === botKey) return true
    if (focusLevel === 'overview') return botStatus === 'active' || botStatus === 'supervising'
    return focusedRoomId === botRoomId || botStatus === 'active'
  }

  if (isRoomsLoading || !layout) return null

  const {
    roomPositions,
    buildingWidth,
    buildingDepth,
    buildingCenterX,
    buildingCenterZ,
    parkingArea,
    entranceX,
    cols,
    rows,
    gridOriginX,
    gridOriginZ,
  } = layout

  return (
    <>
      <WorldLighting />
      <EnvironmentSwitcher buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
      <group position={[buildingCenterX, 0, buildingCenterZ]}>
        <BuildingFloor width={buildingWidth} depth={buildingDepth} />
        <BuildingWalls
          width={buildingWidth}
          depth={buildingDepth}
          entranceWidth={5}
          entranceOffset={entranceX - buildingCenterX}
        />
      </group>
      <ParkingAreaFloor
        x={parkingArea.x}
        z={parkingArea.z}
        width={parkingArea.width}
        depth={parkingArea.depth}
      />
      <ParkingArea3D
        position={[parkingArea.x, 0, parkingArea.z]}
        width={parkingArea.width}
        depth={parkingArea.depth}
      />
      <HallwayFloorLines
        roomSize={ROOM_SIZE}
        hallwayWidth={HALLWAY_WIDTH}
        cols={cols}
        rows={rows}
        gridOriginX={gridOriginX}
        gridOriginZ={gridOriginZ}
      />
      <Hallway
        roomPositions={roomPositions}
        roomSize={ROOM_SIZE}
        hallwayWidth={HALLWAY_WIDTH}
        cols={cols}
        rows={rows}
        gridOriginX={gridOriginX}
        gridOriginZ={gridOriginZ}
      />

      <CameraController roomPositions={cameraRoomPositions} />
      <CameraDebugTracker enabled={gridDebugEnabled} />

      <FirstPersonController
        roomPositions={roomPositions.map((rp) => ({
          roomId: rp.room.id,
          roomName: rp.room.name,
          position: rp.position,
        }))}
        roomSize={ROOM_SIZE}
        buildingWidth={buildingWidth}
        buildingDepth={buildingDepth}
        onEnterRoom={onEnterRoom}
        onLeaveRoom={onLeaveRoom}
      />

      {roomPositions.map(({ room, position, size: roomSize }) => {
        const botsInRoom = roomBots.get(room.id) || []
        const visibleBots = botsInRoom.slice(0, SESSION_CONFIG.maxVisibleBotsPerRoom)
        const overflowCount = botsInRoom.length - visibleBots.length
        const botPositions = getBotPositionsInRoom(position, roomSize, visibleBots.length)
        const bounds = roomBoundsMap.get(room.id)!

        return (
          <group key={room.id}>
            <Room3D
              room={room}
              position={position}
              size={roomSize}
              isCreatorMode={!!selectedPropId && !!onPlaceProp}
            />
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
                roomName={room.name}
              />
            ))}
            {overflowCount > 0 && (
              <Html
                position={[position[0] + roomSize / 2 - 1.5, 1.2, position[2] + roomSize / 2 - 1]}
                center
                distanceFactor={15}
                zIndexRange={[1, 5]}
                style={{ pointerEvents: 'none' }}
              >
                <div
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    padding: '3px 8px',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  +{overflowCount} more
                </div>
              </Html>
            )}
          </group>
        )
      })}

      {parkingBots.length > 0 &&
        (() => {
          const positions = getBotPositionsInParking(
            parkingArea.x,
            parkingArea.z,
            parkingArea.width,
            parkingArea.depth,
            parkingBots.length
          )
          const bounds = parkingBoundsStable!
          return parkingBots.map((bot, i) => (
            <Bot3D
              key={bot.key}
              position={positions[i] || [parkingArea.x, 0.14, parkingArea.z]}
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

      <WanderingBots3D
        sleepingSessions={parkingSessions}
        displayNames={displayNames}
        buildingWidth={buildingWidth}
        buildingDepth={buildingDepth}
        roomObstacles={roomObstacles}
        onBotClick={onBotClick}
      />

      {/* ── Creator Mode: Placed Props ── */}
      {placedProps.length > 0 && <PlacedPropsRenderer placedProps={placedProps} />}

      {/* ── Creator Mode: Ghost preview + click plane ── */}
      {selectedPropId && onPlaceProp && (
        <>
          <PlacementGhost
            propId={selectedPropId}
            rotation={pendingRotation}
            onPositionChange={onGhostPosition ?? (() => {})}
          />
          <PlacementClickPlane enabled={!!selectedPropId} onPlace={onPlaceProp} />
        </>
      )}
    </>
  )
}

// Re-export for use in Canvas wrapper
export { LoadingFallback }

import { Suspense, useMemo, useState, useEffect, useCallback, useRef, Component, type ReactNode } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import { Html } from '@react-three/drei'

// ─── Error Boundary for Canvas ─────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class CanvasErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Canvas Error Boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-red-50 text-red-800 p-8">
          <div className="max-w-lg">
            <h2 className="text-xl font-bold mb-2">🔥 3D World Crashed</h2>
            <pre className="bg-red-100 p-4 rounded text-sm overflow-auto max-h-64">
              {this.state.error?.message || 'Unknown error'}
              {'\n\n'}
              {this.state.error?.stack}
            </pre>
            <button 
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
import { WorldLighting } from './WorldLighting'
import { BuildingFloor } from './BuildingFloor'
import { BuildingWalls } from './BuildingWalls'
import { Hallway } from './Hallway'
import { HallwayFloorLines } from './HallwayFloorLines'
import { ParkingArea3D } from './ParkingArea3D'
import { WanderingBots3D, type RoomObstacle } from './WanderingBots3D'
import { Room3D } from './Room3D'
import { Bot3D, type BotStatus } from './Bot3D'
import { BotInfoPanel } from './BotInfoPanel'
import { RoomInfoPanel } from './RoomInfoPanel'
import { ProjectDocsPanel } from './ProjectDocsPanel'
import { useRooms, type Room } from '@/hooks/useRooms'
import { useAgentsRegistry, type AgentRuntime } from '@/hooks/useAgentsRegistry'
import { useSessionActivity } from '@/hooks/useSessionActivity'
import { useSessionDisplayNames } from '@/hooks/useSessionDisplayNames'
import { useToonMaterialProps } from './utils/toonMaterials'
import { EnvironmentSwitcher } from './environments'
import { getBotConfigFromSession, isSubagent } from './utils/botVariants'
import { getSessionDisplayName } from '@/lib/minionUtils'
// Fallback chain for room assignment:
//   1. Explicit assignment (session-room-assignments API)
//   2. Rules-based routing (room-assignment-rules API, via getRoomForSession)
//   3. Agent default_room_id
//   4. First room in the list
// getDefaultRoomForSession from roomsConfig.ts is deprecated and no longer used here.
import { splitSessionsForDisplay } from '@/lib/sessionFiltering'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { CameraController } from './CameraController'
import { FirstPersonController, FirstPersonHUD } from './FirstPersonController'
import { RoomTabsBar } from './RoomTabsBar'
import { WorldNavigation } from './WorldNavigation'
import { ActionBar } from './ActionBar'
import { TasksWindow } from './TasksWindow'
import { AgentTopBar } from './AgentTopBar'
import { useActiveTasks } from '@/hooks/useActiveTasks'
import { WorldFocusProvider, useWorldFocus, type FocusLevel } from '@/contexts/WorldFocusContext'
import { DragDropProvider, useDragState } from '@/contexts/DragDropContext'
import { useDemoMode } from '@/contexts/DemoContext'
import { useChatContext } from '@/contexts/ChatContext'
import { LogViewer } from '@/components/sessions/LogViewer'
import { TaskBoardOverlay, HQTaskBoardOverlay } from '@/components/tasks'
import { LightingDebugPanel } from './LightingDebugPanel'
import { DebugPanel } from './DebugPanel'
import { useDebugBots, type DebugBot } from '@/hooks/useDebugBots'
import { useDebugKeyboardShortcuts } from '@/hooks/useDebugKeyboardShortcuts'
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
// MAX_VISIBLE_BOTS_PER_ROOM read from SESSION_CONFIG at render time
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

// ─── Parking / Break Area ──────────────────────────────────────

function ParkingAreaFloor({ x, z, width, depth }: { x: number; z: number; width: number; depth: number }) {
  const floorToon = useToonMaterialProps('#BFB090')
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

// ─── Bot Status (accurate, matching 2D) ────────────────────────

function getAccurateBotStatus(session: CrewSession, isActive: boolean): BotStatus {
  if (isActive) return 'active'
  const idleMs = Date.now() - session.updatedAt
  if (idleMs < SESSION_CONFIG.botIdleThresholdMs) return 'idle'
  if (idleMs < SESSION_CONFIG.botSleepingThresholdMs) return 'sleeping'
  return 'offline'
}

// ─── Activity Text for Bubbles ──────────────────────────────────

/**
 * Convert a kebab-case or snake_case label into a human-readable summary.
 * e.g. "fix-wall-alignment" → "Fixing wall alignment"
 *      "review-pr-42" → "Reviewing PR 42"
 *      "writing-desert-env" → "Writing desert env"
 */
function humanizeLabel(label: string): string {
  // Replace separators with spaces
  let text = label.replace(/[-_]+/g, ' ').trim()
  if (!text) return ''

  // Common prefixes that indicate ongoing action — convert to gerund
  const gerundMap: Record<string, string> = {
    'fix': 'Fixing',
    'review': 'Reviewing',
    'write': 'Writing',
    'build': 'Building',
    'add': 'Adding',
    'update': 'Updating',
    'debug': 'Debugging',
    'test': 'Testing',
    'refactor': 'Refactoring',
    'deploy': 'Deploying',
    'check': 'Checking',
    'create': 'Creating',
    'implement': 'Implementing',
    'remove': 'Removing',
    'delete': 'Deleting',
    'move': 'Moving',
    'merge': 'Merging',
    'setup': 'Setting up',
    'clean': 'Cleaning',
    'analyze': 'Analyzing',
    'design': 'Designing',
    'optimize': 'Optimizing',
    'migrate': 'Migrating',
    'scan': 'Scanning',
    'fetch': 'Fetching',
    'parse': 'Parsing',
    'monitor': 'Monitoring',
    'install': 'Installing',
    'configure': 'Configuring',
    'research': 'Researching',
  }

  const words = text.split(' ')
  const firstWord = words[0].toLowerCase()
  if (gerundMap[firstWord]) {
    words[0] = gerundMap[firstWord]
  } else {
    // Capitalize first word
    words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1)
  }

  // Uppercase common acronyms
  const acronyms = new Set(['pr', 'ui', 'ux', 'api', 'css', 'html', 'db', 'ci', 'cd', 'ssr', 'seo', 'jwt', 'sdk'])
  for (let i = 1; i < words.length; i++) {
    if (acronyms.has(words[i].toLowerCase())) {
      words[i] = words[i].toUpperCase()
    }
  }

  return words.join(' ')
}

/**
 * Extract a short task summary from the last few messages.
 * Looks for the last user message text to understand what the bot is working on.
 */
function extractTaskSummary(messages: CrewSession['messages']): string | null {
  if (!messages || messages.length === 0) return null

  // Scan recent messages backwards looking for useful context
  const recent = messages.slice(-5)
  let lastToolCall: string | null = null
  let isThinking = false

  for (let i = recent.length - 1; i >= 0; i--) {
    const msg = recent[i]
    if (!Array.isArray(msg.content)) continue

    for (const block of msg.content) {
      // Track latest tool call
      if ((block.type === 'toolCall' || block.type === 'tool_use') && block.name && !lastToolCall) {
        lastToolCall = block.name
      }
      // Track thinking
      if (block.type === 'thinking' && !isThinking) {
        isThinking = true
      }
    }
  }

  if (isThinking && !lastToolCall) return '💭 Thinking…'
  if (lastToolCall) return `🔧 ${lastToolCall}`
  return null
}

function getActivityText(session: CrewSession, isActive: boolean): string {
  if (isActive) {
    // 1. Prefer session label — humanize it into a task summary
    if (session.label) {
      const humanized = humanizeLabel(session.label)
      if (humanized) {
        // Append "..." to indicate it's ongoing
        return humanized.endsWith('…') ? humanized : humanized + '…'
      }
    }

    // 2. Extract context from recent messages (tool calls, thinking)
    const messageSummary = extractTaskSummary(session.messages)
    if (messageSummary) return messageSummary

    // 3. Generic fallback
    return 'Working…'
  }

  // Idle — check if there's a label to show what was last worked on
  if (session.label) {
    const humanized = humanizeLabel(session.label)
    if (humanized) return `✅ ${humanized}`
  }

  return '💤 Idle'
}

// ─── Bot Placement Helpers ──────────────────────────────────────

function getBotPositionsInRoom(
  roomPos: [number, number, number],
  roomSize: number,
  botCount: number,
): [number, number, number][] {
  const positions: [number, number, number][] = []
  // Floor top surface is at roomPos[1] + 0.16 (box center 0.08 + half-height 0.08).
  // Place bots at floor level so feet (at group origin with yOffset=0.33) touch the surface.
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
  // Parking floor: box center at y=0.08, thickness 0.12 (rotated), top surface at 0.14
  const floorY = 0.14
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

// ─── Debug Bot → CrewSession Conversion ─────────────────────────

function debugBotToCrewSession(bot: DebugBot): CrewSession {
  const now = Date.now()
  // Calculate updatedAt based on status so getAccurateBotStatus works correctly
  let updatedAt = now
  if (bot.status === 'idle') {
    updatedAt = now - 10_000 // 10s ago — past active threshold but within idle
  } else if (bot.status === 'sleeping') {
    updatedAt = now - 600_000 // 10 min ago — past idle threshold
  } else if (bot.status === 'offline') {
    updatedAt = now - 7_200_000 // 2 hours ago — well past sleeping threshold
  }

  return {
    key: `debug:${bot.id}`,
    kind: 'debug',
    channel: 'debug',
    displayName: `🧪 ${bot.name}`,
    label: `debug-${bot.status}`,
    updatedAt,
    sessionId: bot.id,
    model: 'debug-bot',
  }
}

// Flag to check if a session key is a debug bot
function isDebugSession(key: string): boolean {
  return key.startsWith('debug:debug-')
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
  onEnterRoom?: (roomName: string) => void
  onLeaveRoom?: () => void
  /** Debug bot room overrides: session key → room ID */
  debugRoomMap?: Map<string, string>
  /** Rooms data passed from outside Canvas (hooks don't work reliably inside R3F Canvas) */
  rooms: Room[]
  getRoomForSession: (sessionKey: string, sessionData?: { label?: string; model?: string; channel?: string }) => string | undefined
  isRoomsLoading: boolean
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
  onEnterRoom,
  onLeaveRoom,
  debugRoomMap,
  rooms,
  getRoomForSession,
  isRoomsLoading,
}: SceneContentProps) {
  void _settings // Available for future use (e.g. animation speed)
  // Combine all sessions for agent registry lookup
  const allSessions = useMemo(
    () => [...visibleSessions, ...parkingSessions],
    [visibleSessions, parkingSessions],
  )
  const { agents: agentRuntimes } = useAgentsRegistry(allSessions)

  const layout = useMemo(() => {
    if (rooms.length === 0) return null
    return calculateBuildingLayout(rooms)
  }, [rooms])

  // ─── Stable room bounds (avoid new objects every render) ──────
  const roomBoundsMap = useMemo(() => {
    if (!layout) return new Map<string, RoomBounds>()
    const map = new Map<string, RoomBounds>()
    for (const { room, position } of layout.roomPositions) {
      map.set(room.id, getRoomBounds(position, ROOM_SIZE))
    }
    return map
  }, [layout])

  const parkingBoundsStable = useMemo(() => {
    if (!layout) return undefined
    const { parkingArea } = layout
    return getParkingBounds(parkingArea.x, parkingArea.z, parkingArea.width, parkingArea.depth)
  }, [layout])

  // Room obstacles for wandering bots to avoid (rooms + parking area)
  const roomObstacles = useMemo<RoomObstacle[]>(() => {
    if (!layout) return []
    const obstacles: RoomObstacle[] = layout.roomPositions.map(({ position }) => ({
      cx: position[0],
      cz: position[2],
      halfW: ROOM_SIZE / 2,
      halfD: ROOM_SIZE / 2,
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
        // Fallback chain: explicit assignment → rules → agent default → first room
        const roomId = getRoomForSession(runtime.session.key, {
            label: runtime.session.label,
            model: runtime.session.model,
            channel: runtime.session.lastChannel || runtime.session.channel,
          })
          || runtime.agent.default_room_id
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
        // Fallback chain: explicit assignment → rules → agent default → first room
        const roomId = getRoomForSession(child.key, {
          label: child.label,
          model: child.model,
          channel: child.lastChannel || child.channel,
        })
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

      // Debug bots use their assigned room from the debug room map
      const debugRoom = debugRoomMap?.get(session.key)
      // Fallback chain: debug override → explicit assignment → rules → first room
      const roomId = debugRoom
        || getRoomForSession(session.key, {
          label: session.label,
          model: session.model,
          channel: session.lastChannel || session.channel,
        })
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
  }, [visibleSessions, parkingSessions, rooms, agentRuntimes, getRoomForSession, isActivelyRunning, displayNames, debugRoomMap])

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

  // DEBUG: Log loading state

  if (isRoomsLoading || !layout) {
    return null
  }

  const { roomPositions, buildingWidth, buildingDepth, parkingArea, entranceX, cols, rows, gridOriginX, gridOriginZ } = layout

  return (
    <>
      <EnvironmentSwitcher buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
      <BuildingFloor width={buildingWidth} depth={buildingDepth} />
      <BuildingWalls width={buildingWidth} depth={buildingDepth} entranceWidth={5} entranceOffset={entranceX} />
      <ParkingAreaFloor x={parkingArea.x} z={parkingArea.z} width={parkingArea.width} depth={parkingArea.depth} />
      <ParkingArea3D position={[parkingArea.x, 0, parkingArea.z]} width={parkingArea.width} depth={parkingArea.depth} />
      <HallwayFloorLines roomSize={ROOM_SIZE} hallwayWidth={HALLWAY_WIDTH} cols={cols} rows={rows} gridOriginX={gridOriginX} gridOriginZ={gridOriginZ} />
      {/* EntranceLobby removed — will be redesigned later */}
      <Hallway roomPositions={roomPositions} roomSize={ROOM_SIZE} hallwayWidth={HALLWAY_WIDTH} cols={cols} rows={rows} gridOriginX={gridOriginX} gridOriginZ={gridOriginZ} />

      {/* CameraController (inside Canvas, manages camera animation + constraints) */}
      <CameraController roomPositions={cameraRoomPositions} />

      {/* First Person Controller (inside Canvas, manages pointer lock + WASD movement) */}
      <FirstPersonController
        roomPositions={roomPositions.map(rp => ({
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

      {/* Rooms in grid layout */}
      {roomPositions.map(({ room, position }) => {
        const botsInRoom = roomBots.get(room.id) || []
        const visibleBots = botsInRoom.slice(0, SESSION_CONFIG.maxVisibleBotsPerRoom)
        const overflowCount = botsInRoom.length - visibleBots.length
        const botPositions = getBotPositionsInRoom(position, ROOM_SIZE, visibleBots.length)
        const bounds = roomBoundsMap.get(room.id)!

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
                roomName={room.name}
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

      {/* Wandering outdoor bots (sleeping sessions roaming on the grass) */}
      <WanderingBots3D
        sleepingSessions={parkingSessions}
        displayNames={displayNames}
        buildingWidth={buildingWidth}
        buildingDepth={buildingDepth}
        roomObstacles={roomObstacles}
        onBotClick={onBotClick}
      />
    </>
  )
}

// ─── Drag Status Indicator ──────────────────────────────────────

function DragStatusIndicator() {
  const drag = useDragState()
  if (!drag.isDragging) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 18px',
        borderRadius: 14,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.15)',
        animation: 'fadeInDown 0.2s ease-out',
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: 16 }}>🤖</span>
      <span>Moving <strong>{drag.sessionName}</strong></span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>
        Drop on room or outside to unassign · Esc to cancel
      </span>
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────

function World3DViewInner({ sessions, settings, onAliasChanged: _onAliasChanged }: World3DViewProps) {
  // Debug keyboard shortcuts (F2=Grid, F3=Lighting, F4=Bots)
  useDebugKeyboardShortcuts()

  // Debug bots
  const { debugBots, debugBotsEnabled } = useDebugBots()

  // Shared hooks for activity tracking and session filtering
  const { isActivelyRunning: isRealActivelyRunning } = useSessionActivity(sessions)

  // Wrap isActivelyRunning to handle debug bots (active status = actively running)
  const isActivelyRunning = useCallback((key: string): boolean => {
    if (isDebugSession(key)) {
      const botId = key.replace('debug:', '')
      const bot = debugBots.find(b => b.id === botId)
      return bot?.status === 'active'
    }
    return isRealActivelyRunning(key)
  }, [isRealActivelyRunning, debugBots])

  const idleThreshold = settings.parkingIdleThreshold ?? 120
  const { visibleSessions: realVisibleSessions, parkingSessions } = splitSessionsForDisplay(
    sessions, isRealActivelyRunning, idleThreshold,
  )

  // Merge debug bots as fake sessions into visible sessions
  const visibleSessions = useMemo(() => {
    if (!debugBotsEnabled || debugBots.length === 0) return realVisibleSessions
    const debugSessions = debugBots.map(debugBotToCrewSession)
    return [...realVisibleSessions, ...debugSessions]
  }, [realVisibleSessions, debugBots, debugBotsEnabled])

  // Demo mode: merge demo room assignments into the room override map
  const { isDemoMode, demoRoomAssignments } = useDemoMode()

  // Map debug/demo session keys to their assigned rooms
  const debugRoomMap = useMemo(() => {
    const hasDebugBots = debugBotsEnabled && debugBots.length > 0
    const hasDemoAssignments = isDemoMode && demoRoomAssignments.size > 0
    if (!hasDebugBots && !hasDemoAssignments) return undefined

    const map = new Map<string, string>()
    // Debug bots
    if (hasDebugBots) {
      for (const bot of debugBots) {
        map.set(`debug:${bot.id}`, bot.roomId)
      }
    }
    // Demo mode room assignments
    if (hasDemoAssignments) {
      for (const [key, roomId] of demoRoomAssignments) {
        map.set(key, roomId)
      }
    }
    return map
  }, [debugBots, debugBotsEnabled, isDemoMode, demoRoomAssignments])

  // Display names
  const sessionKeys = useMemo(() => sessions.map(s => s.key), [sessions])
  const { displayNames } = useSessionDisplayNames(sessionKeys)

  // Focus state
  const { state: focusState, focusRoom, focusBot, goBack } = useWorldFocus()

  // First person HUD state
  const [fpCurrentRoom, setFpCurrentRoom] = useState<string | null>(null)
  const [fpShowRoomLabel, setFpShowRoomLabel] = useState(false)
  const fpRoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleFpEnterRoom = useCallback((roomName: string) => {
    setFpCurrentRoom(roomName)
    setFpShowRoomLabel(true)
    if (fpRoomTimerRef.current) clearTimeout(fpRoomTimerRef.current)
    fpRoomTimerRef.current = setTimeout(() => setFpShowRoomLabel(false), 2500)
  }, [])

  const handleFpLeaveRoom = useCallback(() => {
    setFpCurrentRoom(null)
    setFpShowRoomLabel(false)
  }, [])

  // Chat context — register focus handler for 3D view
  const { setFocusHandler } = useChatContext()

  // Rooms for overlays (tabs bar, navigation)
  const { rooms, getRoomForSession, refresh: refreshRooms, isLoading: isRoomsLoading } = useRooms()

  // Register 3D focus handler: zoom to bot when 🎯 is clicked in chat panel
  // Use a ref to avoid infinite re-render loop (handleFocusAgent deps change every render
  // → effect re-runs → cleanup bumps ChatContext state → re-render → loop)
  const handleFocusAgentRef = useRef<(sessionKey: string) => void>(() => {})
  handleFocusAgentRef.current = useCallback((sessionKey: string) => {
    // Find the session to determine its room
    const session = [...visibleSessions, ...parkingSessions].find(s => s.key === sessionKey)
    if (!session) return

    // Determine room using same logic as SceneContent
    // Fallback chain: explicit assignment → rules → first room
    const roomId = getRoomForSession(session.key, {
      label: session.label,
      model: session.model,
      channel: session.lastChannel || session.channel,
    })
      || rooms[0]?.id
      || 'headquarters'

    focusBot(sessionKey, roomId)
  }, [visibleSessions, parkingSessions, getRoomForSession, rooms, focusBot])

  useEffect(() => {
    setFocusHandler((sessionKey: string) => handleFocusAgentRef.current(sessionKey))
    return () => setFocusHandler(null)
  }, [setFocusHandler])

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
  const [docsPanel, setDocsPanel] = useState<{ projectId: string; projectName: string; projectColor?: string } | null>(null)

  // TaskBoard overlay state
  const [taskBoardOpen, setTaskBoardOpen] = useState(false)
  const [taskBoardContext, setTaskBoardContext] = useState<{
    projectId: string
    roomId?: string
    agents?: Array<{ session_key: string; display_name: string }>
  } | null>(null)

  // HQ TaskBoard overlay state (cross-project overview)
  const [hqBoardOpen, setHqBoardOpen] = useState(false)

  // Tasks window state (ActionBar toggle)
  const [tasksWindowOpen, setTasksWindowOpen] = useState(false)

  // Fullscreen mode (native browser API)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Listen for fullscreen changes (user can exit via Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  }

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

  // Active tasks for ActionBar badge and TasksWindow
  const { tasks: activeTasks, getTaskOpacity, runningTasks } = useActiveTasks({
    sessions: allSessions,
    enabled: focusState.level !== 'firstperson',
  })

  // Helper to get room for session (for TasksWindow)
  const getTaskRoomForSession = useCallback((sessionKey: string) => {
    const session = allSessions.find(s => s.key === sessionKey)
    return getRoomForSession(sessionKey, {
      label: session?.label,
      model: session?.model,
      channel: session?.lastChannel,
    })
  }, [allSessions, getRoomForSession])

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

  // Get bio and agentId for focused bot from agents registry
  const { agents: agentRuntimesForPanel, refresh: refreshAgents } = useAgentsRegistry(allSessions)
  const focusedBotRuntime = useMemo(() => {
    if (!focusedSession) return null
    return agentRuntimesForPanel.find(
      r => r.agent.agent_session_key === focusedSession.key
        || r.session?.key === focusedSession.key
        || r.childSessions.some(c => c.key === focusedSession.key)
    ) ?? null
  }, [focusedSession, agentRuntimesForPanel])
  const focusedBotBio = focusedBotRuntime?.agent.bio ?? null
  const focusedAgentId = focusedBotRuntime?.agent.id ?? null

  // ─── Room Info Panel: compute sessions in focused room ────────
  const focusedRoom = useMemo(() => {
    if (!focusState.focusedRoomId) return null
    return rooms.find(r => r.id === focusState.focusedRoomId) ?? null
  }, [focusState.focusedRoomId, rooms])

  const focusedRoomSessions = useMemo(() => {
    if (!focusState.focusedRoomId) return []
    const targetRoomId = focusState.focusedRoomId
    return visibleSessions.filter(s => {
      const debugRoom = debugRoomMap?.get(s.key)
      // Fallback chain: debug override → explicit assignment → rules → first room
      const roomId = debugRoom
        || getRoomForSession(s.key, {
          label: s.label,
          model: s.model,
          channel: s.lastChannel || s.channel,
        })
        || rooms[0]?.id
        || 'headquarters'
      return roomId === targetRoomId
    })
  }, [focusState.focusedRoomId, visibleSessions, getRoomForSession, rooms, debugRoomMap])

  // Handle bot click from RoomInfoPanel → focus that bot
  const handleRoomPanelBotClick = useCallback((session: CrewSession) => {
    if (focusState.focusedRoomId) {
      focusBot(session.key, focusState.focusedRoomId)
    }
  }, [focusBot, focusState.focusedRoomId])

  // Content to render
  const worldContent = (
    <div 
      className="relative w-full h-full"
      style={{ minHeight: '600px' }}
    >
        <CanvasErrorBoundary>
          <Canvas
            shadows
            camera={{ position: [-45, 40, -45], fov: 40, near: 0.1, far: 300 }}
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
              onEnterRoom={handleFpEnterRoom}
              onLeaveRoom={handleFpLeaveRoom}
              debugRoomMap={debugRoomMap}
              rooms={rooms}
              getRoomForSession={getRoomForSession}
              isRoomsLoading={isRoomsLoading}
              />
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>

        {/* First Person HUD (rendered on top of everything when in FP mode) */}
        {focusState.level === 'firstperson' && (
          <FirstPersonHUD
            currentRoom={fpCurrentRoom}
            showRoomLabel={fpShowRoomLabel}
          />
        )}

        {/* Back button / navigation (top-left) */}
        <WorldNavigation rooms={rooms} />

        {/* Action Bar (left side, vertical - Photoshop-style toolbar) */}
        {focusState.level !== 'firstperson' && (
          <ActionBar
            runningTaskCount={runningTasks.length}
            tasksWindowOpen={tasksWindowOpen}
            onToggleTasksWindow={() => setTasksWindowOpen(prev => !prev)}
          />
        )}

        {/* Tasks Window (draggable, toggled via ActionBar) */}
        {focusState.level !== 'firstperson' && tasksWindowOpen && (
          <TasksWindow
            tasks={activeTasks}
            getTaskOpacity={getTaskOpacity}
            getRoomForSession={getTaskRoomForSession}
            defaultRoomId={rooms[0]?.id}
            onClose={() => setTasksWindowOpen(false)}
          />
        )}

        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-[60] p-2 rounded-lg backdrop-blur-md bg-white/60 hover:bg-white/80 border border-gray-200/50 shadow-sm text-gray-600 hover:text-gray-900 transition-all opacity-60 hover:opacity-100"
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        {/* Overlay controls hint (hide when any panel is showing or in first person) */}
        {focusState.level !== 'bot' && focusState.level !== 'room' && focusState.level !== 'firstperson' && !isFullscreen && (
          <div className="absolute top-4 right-16 z-50">
            <div className="text-xs px-3 py-1.5 rounded-lg backdrop-blur-md text-gray-700 bg-white/60 border border-gray-200/50 shadow-sm space-y-0.5">
              <div>🖱️ Drag: Rotate · Scroll: Zoom · Right-drag: Pan</div>
              <div>⌨️ WASD: Move · QE: Rotate · Shift: Fast</div>
              <div className="text-gray-400">🐛 F2: Grid · F3: Lighting · F4: Debug Bots · F5: Demo</div>
            </div>
          </div>
        )}

        {/* Room Info Panel (slides in when room is focused, replaces bot panel slot) */}
        {focusState.level === 'room' && focusedRoom && !docsPanel && (
          <RoomInfoPanel
            room={focusedRoom}
            sessions={focusedRoomSessions}
            isActivelyRunning={isActivelyRunning}
            displayNames={displayNames}
            onClose={() => goBack()}
            onBotClick={handleRoomPanelBotClick}
            onFocusRoom={focusRoom}
            onOpenDocs={(projectId, projectName, projectColor) => setDocsPanel({ projectId, projectName, projectColor })}
            onOpenTaskBoard={(projectId, roomId, agents) => {
              setTaskBoardContext({ projectId, roomId, agents })
              setTaskBoardOpen(true)
            }}
            onOpenHQBoard={() => setHqBoardOpen(true)}
          />
        )}

        {/* Project Docs Panel (overlays room info panel when browsing docs) */}
        {docsPanel && (
          <ProjectDocsPanel
            projectId={docsPanel.projectId}
            projectName={docsPanel.projectName}
            projectColor={docsPanel.projectColor}
            onClose={() => setDocsPanel(null)}
          />
        )}

        {/* Bot Info Panel (slides in when bot is focused) */}
        {focusState.level === 'bot' && focusState.focusedBotKey && focusedSession && focusedBotConfig && (
          <BotInfoPanel
            session={focusedSession}
            displayName={displayNames.get(focusState.focusedBotKey) || getSessionDisplayName(focusedSession, null)}
            botConfig={focusedBotConfig}
            status={focusedBotStatus}
            bio={focusedBotBio}
            agentId={focusedAgentId}
            currentRoomId={getRoomForSession(focusedSession.key, { label: focusedSession.label, model: focusedSession.model, channel: focusedSession.lastChannel })}
            onClose={() => goBack()}
            onOpenLog={(session) => {
              setSelectedSession(session)
              setLogViewerOpen(true)
            }}
            onAssignmentChanged={refreshRooms}
            onBioUpdated={refreshAgents}
          />
        )}

        {/* Agent Top Bar (centered top, with pinned agent + assistent + picker) */}
        <AgentTopBar
          sessions={allSessions}
          getBotConfig={getBotConfigFromSession}
          getRoomForSession={getRoomForSession}
          defaultRoomId={rooms[0]?.id}
          isActivelyRunning={isActivelyRunning}
          displayNames={displayNames}
          rooms={rooms}
        />

        {/* Drag status indicator */}
        <DragStatusIndicator />

        {/* Room tabs bar (bottom, hidden in first person) */}
        {focusState.level !== 'firstperson' && (
          <RoomTabsBar
            rooms={rooms}
            roomBotCounts={roomBotCounts}
            parkingBotCount={parkingSessions.length}
          />
        )}

        {/* Lighting Debug Panel (floating overlay) */}
        <LightingDebugPanel />

        {/* Debug Bots Panel (floating overlay, left side) */}
        <DebugPanel />

        {/* LogViewer (outside Canvas) */}
        <LogViewer session={selectedSession} open={logViewerOpen} onOpenChange={setLogViewerOpen} />

        {/* TaskBoardOverlay (outside Canvas) */}
        {taskBoardContext && (
          <TaskBoardOverlay
            open={taskBoardOpen}
            onOpenChange={setTaskBoardOpen}
            projectId={taskBoardContext.projectId}
            roomId={taskBoardContext.roomId}
            agents={taskBoardContext.agents}
          />
        )}

        {/* HQ TaskBoardOverlay (cross-project overview, for Headquarters room) */}
        <HQTaskBoardOverlay
          open={hqBoardOpen}
          onOpenChange={setHqBoardOpen}
        />
      </div>
  )

  return (
    <DragDropProvider onAssignmentChanged={refreshRooms}>
      {worldContent}
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

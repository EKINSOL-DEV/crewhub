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
import { Bot3D } from './Bot3D'
import type { BotStatus } from './botConstants'
import { BotInfoPanel } from './BotInfoPanel'
import { BotQuickActions } from './BotQuickActions'
import { RoomInfoPanel } from './RoomInfoPanel'
import { ContextInspector } from './ContextInspector'
import { ProjectDocsPanel } from './ProjectDocsPanel'
import { useRooms, type Room } from '@/hooks/useRooms'
import { useAgentsRegistry, type AgentRuntime } from '@/hooks/useAgentsRegistry'
import { useSessionActivity } from '@/hooks/useSessionActivity'
import { useSessionDisplayNames } from '@/hooks/useSessionDisplayNames'
import { useToonMaterialProps } from './utils/toonMaterials'
import { EnvironmentSwitcher } from './environments'
import { getBotConfigFromSession, isSubagent } from './utils/botVariants'
import { getSessionDisplayName, hasActiveSubagents } from '@/lib/minionUtils'
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
import { useTasks } from '@/hooks/useTasks'
import { WorldFocusProvider, useWorldFocus, type FocusLevel } from '@/contexts/WorldFocusContext'
import { MeetingProvider, useMeetingContext } from '@/contexts/MeetingContext'
import { meetingGatheringState } from '@/lib/meetingStore'
import { DragDropProvider, useDragState } from '@/contexts/DragDropContext'
import { useDemoMode } from '@/contexts/DemoContext'
import { useChatContext } from '@/contexts/ChatContext'
import { TaskBoardProvider } from '@/contexts/TaskBoardContext'
import { LogViewer } from '@/components/sessions/LogViewer'
import { MeetingDialog, MeetingProgressView, MeetingOutput, MeetingResultsPanel } from '@/components/meetings'
import { DemoMeetingButton } from '@/components/demo/DemoMeetingButton'
import { ToastContainer } from '@/components/ui/toast-container'
import { useZenMode } from '@/components/zen'
import { TaskBoardOverlay, HQTaskBoardOverlay } from '@/components/tasks'
import { LightingDebugPanel } from './LightingDebugPanel'
import { DebugPanel } from './DebugPanel'
import { CameraDebugTracker, CameraDebugHUD } from './CameraDebugOverlay'
import { useDebugBots, type DebugBot } from '@/hooks/useDebugBots'
import { useDebugKeyboardShortcuts } from '@/hooks/useDebugKeyboardShortcuts'
import { useGridDebug } from '@/hooks/useGridDebug'
import type { CrewSession } from '@/lib/api'
import type { SessionsSettings } from '@/components/sessions/SettingsPanel'

interface World3DViewProps {
  sessions: CrewSession[]
  settings: SessionsSettings
  onAliasChanged?: () => void
}

// ─── Meeting Overlays ──────────────────────────────────────────

function MeetingOverlays({ agentRuntimes, rooms }: { agentRuntimes: AgentRuntime[]; rooms: Room[] }) {
  const {
    meeting, view, dialogRoomContext,
    openDialog: _od, closeDialog, showProgress, showOutput, closeView,
    openInSidebar, followUpContext, openFollowUp,
  } = useMeetingContext()
  void _od

  // Find HQ room as default fallback
  const hqRoom = rooms.find(r => r.name.toLowerCase().includes('headquarter') || r.name.toLowerCase() === 'hq')

  // Use room context from the clicked table, or fall back to HQ
  const dialogRoom = dialogRoomContext
    ? rooms.find(r => r.id === dialogRoomContext.roomId) || null
    : null
  const effectiveRoomId = dialogRoomContext?.roomId || hqRoom?.id
  const effectiveProjectId = dialogRoomContext?.projectId || hqRoom?.project_id || undefined
  const effectiveProjectName = dialogRoomContext?.projectName || dialogRoom?.project_name || hqRoom?.project_name || undefined

  return (
    <>
      {/* Meeting Dialog (with History tab and Follow-up support) */}
      <MeetingDialog
        open={view === 'dialog'}
        onOpenChange={(open) => { if (!open) closeDialog() }}
        agents={agentRuntimes}
        roomId={effectiveRoomId}
        projectId={effectiveProjectId}
        projectName={effectiveProjectName}
        onStart={async (params) => {
          await meeting.startMeeting(params)
        }}
        meetingInProgress={meeting.isActive}
        onViewProgress={showProgress}
        followUpContext={followUpContext}
        onViewResults={(meetingId) => openInSidebar(meetingId)}
      />

      {/* Meeting Progress Panel (right side overlay) */}
      {(view === 'progress') && (
        <div className="fixed right-0 top-12 bottom-12 w-96 z-30 shadow-xl border-l bg-background">
          <MeetingProgressView
            meeting={meeting}
            onCancel={async () => { await meeting.cancelMeeting() }}
            onViewOutput={showOutput}
          />
        </div>
      )}

      {/* Meeting Output Panel — Fullscreen overlay */}
      {view === 'output' && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
          <div className="flex-1 flex items-stretch justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-5xl bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden">
              <MeetingOutput
                meeting={meeting}
                onClose={closeView}
                mode="fullscreen"
                onStartFollowUp={() => {
                  if (meeting.meetingId) {
                    closeView()
                    openFollowUp(meeting.meetingId)
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* F2: Sidebar Results Panel */}
      <MeetingResultsPanel />
    </>
  )
}

// ─── Layout Constants ──────────────────────────────────────────
const ROOM_SIZE = 12
const HQ_SIZE = 16 // HQ is larger — command center feel
const HALLWAY_WIDTH = 4
// GRID_SPACING removed — radial layout no longer uses fixed grid spacing
const BUILDING_PADDING = 3 // padding inside building walls around the grid
// MAX_VISIBLE_BOTS_PER_ROOM read from SESSION_CONFIG at render time
const PARKING_WIDTH = 9 // width of parking/break area (compact break room)
const PARKING_DEPTH_MIN = ROOM_SIZE // minimum depth (≈ 1 room tall)

/** Get the effective size for a room (HQ is larger) */
export function getRoomSize(room: { is_hq?: boolean }): number {
  return room.is_hq ? HQ_SIZE : ROOM_SIZE
}

// ─── Building Layout Calculation ───────────────────────────────
interface BuildingLayout {
  roomPositions: { room: ReturnType<typeof useRooms>['rooms'][0]; position: [number, number, number]; size: number }[]
  buildingWidth: number
  buildingDepth: number
  buildingCenterX: number
  parkingArea: { x: number; z: number; width: number; depth: number }
  entranceX: number
  cols: number
  rows: number
  gridOriginX: number
  gridOriginZ: number
}

/**
 * Centered 3×3 grid layout:
 * - HQ (larger) sits at the center cell
 * - 8 peripheral rooms fill the remaining cells
 * - Even spacing between all rooms with margin from campus edges
 */
function calculateBuildingLayout(rooms: ReturnType<typeof useRooms>['rooms']): BuildingLayout {
  const sorted = [...rooms].sort((a, b) => a.sort_order - b.sort_order)

  const hqRoom = sorted.find(r => r.is_hq)
  const otherRooms = sorted.filter(r => !r.is_hq)
  const centerRoom = hqRoom || sorted[0]
  const peripheralRooms = hqRoom ? otherRooms : sorted.slice(1)

  // Grid parameters — spacing is center-to-center distance
  // Using HQ_SIZE as the cell pitch so larger HQ fits without overlap
  const cellPitch = HQ_SIZE + HALLWAY_WIDTH // 16 + 4 = 20

  const cols = 3
  const rows = 3

  // Grid cell order: row-major, center cell (1,1) reserved for HQ
  // Order: (0,0) (0,1) (0,2) (1,0) [HQ at 1,1] (1,2) (2,0) (2,1) (2,2)
  const gridCells: [number, number][] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 1 && c === 1) continue // skip center for HQ
      gridCells.push([c, r])
    }
  }

  // Center of grid at origin (0, 0)
  const gridOffsetX = -(cols - 1) * cellPitch / 2
  const gridOffsetZ = -(rows - 1) * cellPitch / 2

  const roomPositions: BuildingLayout['roomPositions'] = []

  // Place HQ at center
  roomPositions.push({
    room: centerRoom,
    position: [0, 0, 0],
    size: getRoomSize(centerRoom),
  })

  // Place peripheral rooms in grid cells
  for (let i = 0; i < Math.min(peripheralRooms.length, gridCells.length); i++) {
    const [c, r] = gridCells[i]
    const x = gridOffsetX + c * cellPitch
    const z = gridOffsetZ + r * cellPitch
    roomPositions.push({
      room: peripheralRooms[i],
      position: [x, 0, z],
      size: ROOM_SIZE,
    })
  }

  // Bounding box
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity
  for (const rp of roomPositions) {
    const half = rp.size / 2
    minX = Math.min(minX, rp.position[0] - half)
    maxX = Math.max(maxX, rp.position[0] + half)
    minZ = Math.min(minZ, rp.position[2] - half)
    maxZ = Math.max(maxZ, rp.position[2] + half)
  }

  // Parking area to the right
  const parkingX = maxX + BUILDING_PADDING + HALLWAY_WIDTH / 2 + PARKING_WIDTH / 2
  const parkingZ = 0
  const parkingRightEdge = parkingX + PARKING_WIDTH / 2 + BUILDING_PADDING
  const leftEdge = minX - BUILDING_PADDING

  const buildingWidth = parkingRightEdge - leftEdge
  const buildingDepth = (maxZ - minZ) + BUILDING_PADDING * 2
  const buildingCenterX = (leftEdge + parkingRightEdge) / 2

  const parkingDepth = Math.min(Math.max(PARKING_DEPTH_MIN, ROOM_SIZE * 2), buildingDepth - BUILDING_PADDING * 2)
  const parkingArea = { x: parkingX, z: parkingZ, width: PARKING_WIDTH, depth: parkingDepth }

  const entranceX = 0

  const gridOriginX = gridOffsetX
  const gridOriginZ = gridOffsetZ

  return { roomPositions, buildingWidth, buildingDepth, buildingCenterX, parkingArea, entranceX, cols, rows, gridOriginX, gridOriginZ }
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

function getAccurateBotStatus(session: CrewSession, isActive: boolean, allSessions?: CrewSession[]): BotStatus {
  if (isActive) return 'active'
  const idleMs = Date.now() - session.updatedAt
  if (idleMs < SESSION_CONFIG.botIdleThresholdMs) return 'idle'

  // Check for active subagents before marking as sleeping
  if (allSessions && hasActiveSubagents(session, allSessions)) return 'supervising'

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

function getActivityText(session: CrewSession, isActive: boolean, allSessions?: CrewSession[]): string {
  // Check if supervising subagents
  if (!isActive && allSessions && hasActiveSubagents(session, allSessions)) {
    const agentId = (session.key || "").split(":")[1]
    const now = Date.now()
    const activeChild = allSessions
      .filter(s => {
        const parts = s.key.split(":")
        return parts[1] === agentId
          && (parts[2]?.includes("subagent") || parts[2]?.includes("spawn"))
          && (now - s.updatedAt) < SESSION_CONFIG.statusActiveThresholdMs
      })
      .sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (activeChild) {
      const label = activeChild.label ? humanizeLabel(activeChild.label) : 'subagent'
      return `👁️ Supervising: ${label}`
    }
    return '👁️ Supervising subagent'
  }

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
  /** Session keys of bots currently in an active meeting */
  meetingParticipantKeys?: Set<string>
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
  meetingParticipantKeys,
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

  // Room obstacles for wandering bots to avoid (rooms + parking area)
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
    // Override status for bots currently in a meeting
    const status: BotStatus = meetingParticipantKeys?.has(session.key) ? 'meeting' : baseStatus
    const config = getBotConfigFromSession(session.key, session.label, _runtime?.agent?.color)
    const name = getSessionDisplayName(session, displayNames.get(session.key))
    const scale = isSubagent(session.key) ? 0.6 : 1.0
    const activity = getActivityText(session, isActive, allSessions)
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

  // ─── Populate meeting store with room layout for pathfinding ──
  useEffect(() => {
    if (!layout) return
    const roomPosMap = new Map<string, { x: number; z: number; doorX: number; doorZ: number }>()
    for (const { room, position, size } of layout.roomPositions) {
      roomPosMap.set(room.id, {
        x: position[0],
        z: position[2],
        doorX: position[0], // door is centered on room X
        doorZ: position[2] - size / 2, // door is on -Z side
      })
    }
    meetingGatheringState.roomPositions = roomPosMap
    meetingGatheringState.roomSize = ROOM_SIZE // average for pathfinding

    // Populate agent → room mapping
    const agentRooms = new Map<string, string>()
    for (const [roomId, bots] of roomBots) {
      for (const bot of bots) {
        agentRooms.set(bot.key, roomId)
      }
    }
    meetingGatheringState.agentRooms = agentRooms
  }, [layout, roomBots])

  // Build room positions for CameraController (MUST be before early return to respect hooks rules)
  const cameraRoomPositions = useMemo(
    () => layout?.roomPositions.map(rp => ({ roomId: rp.room.id, position: rp.position, size: rp.size })) ?? [],
    [layout],
  )

  // Helper: should a bot show its label based on focus level?
  const shouldShowLabel = (botStatus: BotStatus, botRoomId: string): boolean => {
    if (focusLevel === 'overview') {
      return botStatus === 'active' || botStatus === 'supervising'
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
    if (focusLevel === 'overview') return botStatus === 'active' || botStatus === 'supervising'
    // Room focus: all bots in focused room + active bots elsewhere
    return focusedRoomId === botRoomId || botStatus === 'active'
  }

  // DEBUG: Log loading state

  if (isRoomsLoading || !layout) {
    return null
  }

  const { roomPositions, buildingWidth, buildingDepth, buildingCenterX, parkingArea, entranceX, cols, rows, gridOriginX, gridOriginZ } = layout

  return (
    <>
      <EnvironmentSwitcher buildingWidth={buildingWidth} buildingDepth={buildingDepth} />
      <group position={[buildingCenterX, 0, 0]}>
        <BuildingFloor width={buildingWidth} depth={buildingDepth} />
        <BuildingWalls width={buildingWidth} depth={buildingDepth} entranceWidth={5} entranceOffset={entranceX - buildingCenterX} />
      </group>
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

      {/* Rooms in radial layout (HQ at center, others around it) */}
      {roomPositions.map(({ room, position, size: roomSize }) => {
        const botsInRoom = roomBots.get(room.id) || []
        const visibleBots = botsInRoom.slice(0, SESSION_CONFIG.maxVisibleBotsPerRoom)
        const overflowCount = botsInRoom.length - visibleBots.length
        const botPositions = getBotPositionsInRoom(position, roomSize, visibleBots.length)
        const bounds = roomBoundsMap.get(room.id)!

        return (
          <group key={room.id}>
            <Room3D room={room} position={position} size={roomSize} />
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
        zIndex: 25,
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
  // ── Zen Mode: pause render loop when Zen Mode is active ───────────────
  const { isActive: isZenModeActive } = useZenMode()

  // ── Tauri: pause render loop when window is hidden ─────────────────────
  // When the Tauri 3D World window is hidden (via tray click or close),
  // the document becomes invisible. Stopping the render loop saves GPU/CPU
  // and prevents WebGL resource leaks while the window is not visible.
  // Also pauses when Zen Mode is active (full-screen overlay, 3D not visible).
  const [canvasFrameloop, setCanvasFrameloop] = useState<'always' | 'demand' | 'never'>('always')
  useEffect(() => {
    const handleVisibilityChange = () => {
      setCanvasFrameloop(document.hidden || isZenModeActive ? 'never' : 'always')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isZenModeActive])

  // Immediately respond to Zen Mode toggle (don't wait for visibility event)
  useEffect(() => {
    setCanvasFrameloop(document.hidden || isZenModeActive ? 'never' : 'always')
  }, [isZenModeActive])

  // Meeting context — get active meeting participants for status override
  const { meeting: meetingState, startDemoMeeting, isDemoMeetingActive } = useMeetingContext()
  const meetingParticipantKeys = useMemo(() => {
    if (!meetingState.isActive) return new Set<string>()
    return new Set(meetingState.participants || [])
  }, [meetingState.isActive, meetingState.participants])

  // Debug keyboard shortcuts (F2=Grid, F3=Lighting, F4=Bots)
  useDebugKeyboardShortcuts()

  // Grid debug state (F2) - used for camera debug overlay
  const [gridDebugEnabled] = useGridDebug()

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
  const [contextInspector, setContextInspector] = useState<{ roomId: string; roomName: string } | null>(null)

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

  // Active tasks from task board for ActionBar badge and TasksWindow
  const { tasks: boardTasks } = useTasks({
    autoFetch: focusState.level !== 'firstperson',
  })
  const activeTaskCount = useMemo(() => 
    boardTasks.filter(t => t.status === 'in_progress' || t.status === 'review').length,
    [boardTasks]
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
    return getAccurateBotStatus(focusedSession, isActivelyRunning(focusedSession.key), allSessions)
  }, [focusedSession, isActivelyRunning, allSessions])

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
            frameloop={canvasFrameloop}
            camera={{ position: [-45, 40, -45], fov: 40, near: 0.1, far: 300 }}
            style={{ background: 'linear-gradient(180deg, #87CEEB 0%, #C9E8F5 40%, #E8F0E8 100%)' }}
          >
            <Suspense fallback={<LoadingFallback />}>
              <WorldLighting />
              <CameraDebugTracker enabled={gridDebugEnabled} />
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
              meetingParticipantKeys={meetingParticipantKeys}
              />
            </Suspense>
          </Canvas>
        </CanvasErrorBoundary>

        {/* Camera Debug HUD (F2) */}
        <CameraDebugHUD visible={gridDebugEnabled} />

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
            runningTaskCount={activeTaskCount}
            tasksWindowOpen={tasksWindowOpen}
            onToggleTasksWindow={() => setTasksWindowOpen(prev => !prev)}
          />
        )}

        {/* Tasks Window (draggable, toggled via ActionBar) */}
        {focusState.level !== 'firstperson' && tasksWindowOpen && (
          <TasksWindow
            onClose={() => setTasksWindowOpen(false)}
          />
        )}

        {/* Fullscreen toggle button */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-[25] p-2 rounded-lg backdrop-blur-md bg-white/60 hover:bg-white/80 border border-gray-200/50 shadow-sm text-gray-600 hover:text-gray-900 transition-all opacity-60 hover:opacity-100"
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>

        {/* Overlay controls hint (hide when any panel is showing or in first person) */}
        {focusState.level !== 'bot' && focusState.level !== 'room' && focusState.level !== 'firstperson' && !isFullscreen && (
          <div className="absolute top-4 right-16 z-20">
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
            onOpenTaskBoard={(projectId, roomId, agents) => {
              setTaskBoardContext({ projectId, roomId, agents })
              setTaskBoardOpen(true)
            }}
            onOpenHQBoard={() => setHqBoardOpen(true)}
            onOpenContext={(roomId, roomName) => setContextInspector({ roomId, roomName })}
          />
        )}

        {/* Context Inspector */}
        {contextInspector && (
          <ContextInspector
            roomId={contextInspector.roomId}
            roomName={contextInspector.roomName}
            onClose={() => setContextInspector(null)}
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

        {/* Bot Quick Actions (floating buttons next to BotInfoPanel) */}
        {focusState.level === 'bot' && focusState.focusedBotKey && focusedSession && focusedBotConfig && (
          <BotQuickActions
            session={focusedSession}
            displayName={displayNames.get(focusState.focusedBotKey) || getSessionDisplayName(focusedSession, null)}
            botConfig={focusedBotConfig}
            canChat={/^agent:[a-zA-Z0-9_-]+:main$/.test(focusedSession.key)}
            onOpenLog={(session) => {
              setSelectedSession(session)
              setLogViewerOpen(true)
            }}
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

        {/* Demo Meeting Button (only in demo mode) */}
        {isDemoMode && focusState.level !== 'firstperson' && (
          <DemoMeetingButton
            onClick={startDemoMeeting}
            isActive={isDemoMeetingActive}
            isComplete={meetingState.phase === 'complete'}
          />
        )}

        {/* Meeting UI Overlays */}
        <MeetingOverlays agentRuntimes={agentRuntimesForPanel} rooms={rooms} />

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
    <TaskBoardProvider onOpen={() => setTaskBoardOpen(true)}>
      <DragDropProvider onAssignmentChanged={refreshRooms}>
        {worldContent}
      </DragDropProvider>
    </TaskBoardProvider>
  )
}

export function World3DView(props: World3DViewProps) {
  return (
    <WorldFocusProvider>
      <MeetingProvider>
        <World3DViewInner {...props} />
        <ToastContainer />
      </MeetingProvider>
    </WorldFocusProvider>
  )
}

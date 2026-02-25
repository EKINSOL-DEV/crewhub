import { Suspense, useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { useCreatorMode } from '@/contexts/CreatorModeContext'
import { CreatorBottomBar } from './creator/CreatorBottomBar'
import { API_BASE } from '@/lib/api'
import { showToast } from '@/lib/toast'
import { Canvas } from '@react-three/fiber'
import { CanvasErrorBoundary } from './CanvasErrorBoundary'
import { SceneContent } from './SceneContent'
import { MeetingOverlays } from './MeetingOverlays'
import { DragStatusIndicator } from './DragStatusIndicator'
import { BotInfoPanel } from './BotInfoPanel'
import { BotQuickActions } from './BotQuickActions'
import { RoomInfoPanel } from './RoomInfoPanel'
import { ContextInspector } from './ContextInspector'
import { ProjectDocsPanel } from './ProjectDocsPanel'
import { useRooms } from '@/hooks/useRooms'
import { useAgentsRegistry } from '@/hooks/useAgentsRegistry'
import { useSessionActivity } from '@/hooks/useSessionActivity'
import { useSessionDisplayNames } from '@/hooks/useSessionDisplayNames'
import { getBotConfigFromSession } from './utils/botVariants'
import { getSessionDisplayName } from '@/lib/minionUtils'
import { splitSessionsForDisplay } from '@/lib/sessionFiltering'
import { FirstPersonHUD } from './FirstPersonController'
import { RoomTabsBar } from './RoomTabsBar'
import { WorldNavigation } from './WorldNavigation'
import { ActionBar } from './ActionBar'
import { TasksWindow } from './TasksWindow'
import { AgentTopBar } from './AgentTopBar'
import { useTasks } from '@/hooks/useTasks'
import { WorldFocusProvider, useWorldFocus } from '@/contexts/WorldFocusContext'
import { MeetingProvider, useMeetingContext } from '@/contexts/MeetingContext'
import { DragDropProvider } from '@/contexts/DragDropContext'
import { useDemoMode } from '@/contexts/DemoContext'
import { useChatContext } from '@/contexts/ChatContext'
import { TaskBoardProvider } from '@/contexts/TaskBoardContext'
import { LogViewer } from '@/components/sessions/LogViewer'
import { DemoMeetingButton } from '@/components/demo/DemoMeetingButton'
import { ToastContainer } from '@/components/ui/toast-container'
import { useZenMode } from '@/components/zen'
import { TaskBoardOverlay, HQTaskBoardOverlay } from '@/components/tasks'
import { LightingDebugPanel } from './LightingDebugPanel'
import { DebugPanel } from './DebugPanel'
import { CameraDebugHUD } from './CameraDebugOverlay'
import { useDebugBots } from '@/hooks/useDebugBots'
import { useDebugKeyboardShortcuts } from '@/hooks/useDebugKeyboardShortcuts'
import { useGridDebug } from '@/hooks/useGridDebug'
import { getAccurateBotStatus } from './utils/botActivity'
import { debugBotToCrewSession, isDebugSession } from './utils/botPositions'
import type { CrewSession } from '@/lib/api'
import type { SessionsSettings } from '@/components/sessions/SettingsPanel'

// Re-export for backward compatibility (Bot3D, BotAnimations import RoomBounds from here)
export type { RoomBounds } from './utils/buildingLayout'
// Re-export getRoomSize for any external consumers
export { getRoomSize } from './utils/buildingLayout'

// ─── Loading Fallback ──────────────────────────────────────────

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4f46e5" wireframe />
    </mesh>
  )
}

// ─── Props ─────────────────────────────────────────────────────

interface World3DViewProps {
  sessions: CrewSession[]
  settings: SessionsSettings
  onAliasChanged?: () => void
}

// ─── Inner Component ───────────────────────────────────────────

function World3DViewInner({
  sessions,
  settings,
  onAliasChanged: _onAliasChanged,
}: World3DViewProps) {
  // ── Zen / visibility: pause render loop when hidden ───────────
  const { isActive: isZenModeActive } = useZenMode()
  const [canvasFrameloop, setCanvasFrameloop] = useState<'always' | 'demand' | 'never'>('always')
  useEffect(() => {
    const handleVisibilityChange = () => {
      setCanvasFrameloop(document.hidden || isZenModeActive ? 'never' : 'always')
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isZenModeActive])
  useEffect(() => {
    setCanvasFrameloop(document.hidden || isZenModeActive ? 'never' : 'always')
  }, [isZenModeActive])

  // ── Meeting context ───────────────────────────────────────────
  const { meeting: meetingState, startDemoMeeting, isDemoMeetingActive } = useMeetingContext()
  const meetingParticipantKeys = useMemo(() => {
    if (!meetingState.isActive) return new Set<string>()
    return new Set(meetingState.participants || [])
  }, [meetingState.isActive, meetingState.participants])

  // ── Debug helpers ─────────────────────────────────────────────
  useDebugKeyboardShortcuts()
  const [gridDebugEnabled] = useGridDebug()
  const { debugBots, debugBotsEnabled } = useDebugBots()

  // ── Session data ──────────────────────────────────────────────
  const { isActivelyRunning: isRealActivelyRunning } = useSessionActivity(sessions)
  const isActivelyRunning = useCallback(
    (key: string): boolean => {
      if (isDebugSession(key)) {
        const botId = key.replace('debug:', '')
        return debugBots.find((b) => b.id === botId)?.status === 'active'
      }
      return isRealActivelyRunning(key)
    },
    [isRealActivelyRunning, debugBots]
  )

  const idleThreshold = settings.parkingIdleThreshold ?? 120
  const { visibleSessions: realVisibleSessions, parkingSessions } = splitSessionsForDisplay(
    sessions,
    isRealActivelyRunning,
    idleThreshold
  )
  const visibleSessions = useMemo(() => {
    if (!debugBotsEnabled || debugBots.length === 0) return realVisibleSessions
    return [...realVisibleSessions, ...debugBots.map(debugBotToCrewSession)]
  }, [realVisibleSessions, debugBots, debugBotsEnabled])

  // ── Demo / debug room map ─────────────────────────────────────
  const { isDemoMode, demoRoomAssignments } = useDemoMode()
  const debugRoomMap = useMemo(() => {
    const hasDebug = debugBotsEnabled && debugBots.length > 0
    const hasDemo = isDemoMode && demoRoomAssignments.size > 0
    if (!hasDebug && !hasDemo) return undefined
    const map = new Map<string, string>()
    if (hasDebug) debugBots.forEach((b) => map.set(`debug:${b.id}`, b.roomId))
    if (hasDemo) demoRoomAssignments.forEach((roomId, key) => map.set(key, roomId))
    return map
  }, [debugBots, debugBotsEnabled, isDemoMode, demoRoomAssignments])

  // ── Display names + focus ─────────────────────────────────────
  const sessionKeys = useMemo(() => sessions.map((s) => s.key), [sessions])
  const { displayNames } = useSessionDisplayNames(sessionKeys)
  const { state: focusState, focusRoom, focusBot, goBack } = useWorldFocus()

  // ── First person HUD ──────────────────────────────────────────
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

  // ── Rooms + chat focus handler ────────────────────────────────
  const { setFocusHandler } = useChatContext()
  const { rooms, getRoomForSession, refresh: refreshRooms, isLoading: isRoomsLoading } = useRooms()

  const handleFocusAgentRef = useRef<(sessionKey: string) => void>(() => {})
  handleFocusAgentRef.current = useCallback(
    (sessionKey: string) => {
      const session = [...visibleSessions, ...parkingSessions].find((s) => s.key === sessionKey)
      if (!session) return
      const roomId =
        getRoomForSession(session.key, {
          label: session.label,
          model: session.model,
          channel: session.lastChannel || session.channel,
        }) ||
        rooms[0]?.id ||
        'headquarters'
      focusBot(sessionKey, roomId)
    },
    [visibleSessions, parkingSessions, getRoomForSession, rooms, focusBot]
  )

  useEffect(() => {
    setFocusHandler((sessionKey: string) => handleFocusAgentRef.current(sessionKey))
    return () => setFocusHandler(null)
  }, [setFocusHandler])

  // ── Panel state ───────────────────────────────────────────────
  const [selectedSession, setSelectedSession] = useState<CrewSession | null>(null)
  const [logViewerOpen, setLogViewerOpen] = useState(false)
  const [docsPanel, setDocsPanel] = useState<{
    projectId: string
    projectName: string
    projectColor?: string
  } | null>(null)
  const [contextInspector, setContextInspector] = useState<{
    roomId: string
    roomName: string
  } | null>(null)
  const [taskBoardOpen, setTaskBoardOpen] = useState(false)
  const [taskBoardContext, setTaskBoardContext] = useState<{
    projectId: string
    roomId?: string
    agents?: Array<{ session_key: string; display_name: string }>
  } | null>(null)
  const [hqBoardOpen, setHqBoardOpen] = useState(false)
  const [tasksWindowOpen, setTasksWindowOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ── Creator Mode ──────────────────────────────────────────────
  const {
    isCreatorMode,
    toggleCreatorMode,
    selectedPropId,
    clearSelection,
    pendingRotation,
    placedProps,
    pushAction,
  } = useCreatorMode()

  const ghostPositionRef = useRef<{ x: number; y: number; z: number } | null>(null)

  const handleGhostPosition = useCallback((pos: { x: number; y: number; z: number } | null) => {
    ghostPositionRef.current = pos
  }, [])

  const handlePlaceProp = useCallback(
    async (pos: { x: number; y: number; z: number }) => {
      if (!selectedPropId) return
      const apiKey = localStorage.getItem('crewhub-api-key')
      const headers: HeadersInit = apiKey
        ? { 'X-API-Key': apiKey, 'Content-Type': 'application/json' }
        : { 'Content-Type': 'application/json' }

      try {
        const resp = await fetch(`${API_BASE}/world/props`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            prop_id: selectedPropId,
            position: pos,
            rotation_y: pendingRotation,
            room_id: focusState.focusedRoomId ?? null,
            scale: 1.0,
          }),
        })
        if (resp.ok) {
          const placed = await resp.json()
          // M3: capture scale so redo-place restores the correct scale
          pushAction({
            type: 'place',
            placedId: placed.id,
            propId: placed.prop_id,
            position: placed.position,
            rotation_y: placed.rotation_y,
            scale: placed.scale ?? 1.0,
            roomId: placed.room_id,
          })
          // Clear selection after placement (one at a time)
          clearSelection()
        } else {
          const err = await resp.json().catch(() => ({ detail: 'Unknown error' }))
          // M2: surface auth failures visibly — non-admin users see a clear message
          if (resp.status === 401 || resp.status === 403) {
            showToast({
              message:
                `⛔ Creator Mode requires a manage-scope API key. ${err.detail ?? ''}`.trim(),
              duration: 6000,
            })
          } else {
            console.warn('[CreatorMode] Place prop failed:', err.detail)
          }
        }
      } catch (e) {
        console.warn('[CreatorMode] Place prop error:', e)
      }
    },
    [selectedPropId, pendingRotation, pushAction, clearSelection]
  )

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen()
    else await document.exitFullscreen()
  }

  // ── Derived session/bot data ──────────────────────────────────
  const allSessions = useMemo(
    () => [...visibleSessions, ...parkingSessions],
    [visibleSessions, parkingSessions]
  )
  const { tasks: boardTasks } = useTasks({ autoFetch: focusState.level !== 'firstperson' })
  const activeTaskCount = useMemo(
    () => boardTasks.filter((t) => t.status === 'in_progress' || t.status === 'review').length,
    [boardTasks]
  )

  const focusedSession = useMemo(
    () =>
      focusState.focusedBotKey
        ? (allSessions.find((s) => s.key === focusState.focusedBotKey) ?? null)
        : null,
    [focusState.focusedBotKey, allSessions]
  )
  const focusedBotConfig = useMemo(
    () =>
      focusedSession ? getBotConfigFromSession(focusedSession.key, focusedSession.label) : null,
    [focusedSession]
  )
  const focusedBotStatus = useMemo(() => {
    if (!focusedSession) return 'offline' as const
    return getAccurateBotStatus(focusedSession, isActivelyRunning(focusedSession.key), allSessions)
  }, [focusedSession, isActivelyRunning, allSessions])

  const { agents: agentRuntimesForPanel, refresh: refreshAgents } = useAgentsRegistry(allSessions)
  const focusedBotRuntime = useMemo(() => {
    if (!focusedSession) return null
    return (
      agentRuntimesForPanel.find(
        (r) =>
          r.agent.agent_session_key === focusedSession.key ||
          r.session?.key === focusedSession.key ||
          r.childSessions.some((c) => c.key === focusedSession.key)
      ) ?? null
    )
  }, [focusedSession, agentRuntimesForPanel])
  const focusedBotBio = focusedBotRuntime?.agent.bio ?? null
  const focusedAgentId = focusedBotRuntime?.agent.id ?? null

  // ── Room info panel ───────────────────────────────────────────
  const focusedRoom = useMemo(
    () =>
      focusState.focusedRoomId
        ? (rooms.find((r) => r.id === focusState.focusedRoomId) ?? null)
        : null,
    [focusState.focusedRoomId, rooms]
  )
  const focusedRoomSessions = useMemo(() => {
    if (!focusState.focusedRoomId) return []
    return visibleSessions.filter((s) => {
      const roomId =
        debugRoomMap?.get(s.key) ||
        getRoomForSession(s.key, {
          label: s.label,
          model: s.model,
          channel: s.lastChannel || s.channel,
        }) ||
        rooms[0]?.id ||
        'headquarters'
      return roomId === focusState.focusedRoomId
    })
  }, [focusState.focusedRoomId, visibleSessions, getRoomForSession, rooms, debugRoomMap])

  const handleRoomPanelBotClick = useCallback(
    (session: CrewSession) => {
      if (focusState.focusedRoomId) focusBot(session.key, focusState.focusedRoomId)
    },
    [focusBot, focusState.focusedRoomId]
  )

  const handleBotClick = (_session: CrewSession) => {
    void _session
  }

  const isNotFirstPerson = focusState.level !== 'firstperson'

  return (
    <TaskBoardProvider onOpen={() => setTaskBoardOpen(true)}>
      <DragDropProvider onAssignmentChanged={refreshRooms}>
        <div
          className="relative w-full h-full"
          style={{
            minHeight: '600px',
            boxShadow: isCreatorMode ? '0 0 0 3px gold, 0 0 20px rgba(255,215,0,0.3)' : undefined,
            transition: 'box-shadow 0.3s ease',
          }}
        >
          {/* 3D Canvas */}
          <CanvasErrorBoundary>
            <Canvas
              shadows
              frameloop={canvasFrameloop}
              camera={{ position: [-45, 40, -45], fov: 40, near: 0.1, far: 300 }}
              style={{
                background: 'linear-gradient(180deg, #87CEEB 0%, #C9E8F5 40%, #E8F0E8 100%)',
              }}
            >
              <Suspense fallback={<LoadingFallback />}>
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
                  gridDebugEnabled={gridDebugEnabled}
                  placedProps={placedProps}
                  selectedPropId={isCreatorMode ? selectedPropId : null}
                  pendingRotation={pendingRotation}
                  onPlaceProp={isCreatorMode ? handlePlaceProp : undefined}
                  onGhostPosition={handleGhostPosition}
                />
              </Suspense>
            </Canvas>
          </CanvasErrorBoundary>

          {/* Camera Debug HUD (F2) */}
          <CameraDebugHUD visible={gridDebugEnabled} />

          {/* First Person HUD */}
          {focusState.level === 'firstperson' && (
            <FirstPersonHUD currentRoom={fpCurrentRoom} showRoomLabel={fpShowRoomLabel} />
          )}

          {/* Navigation (top-left) */}
          <WorldNavigation rooms={rooms} isCreatorMode={isCreatorMode} />

          {/* Action Bar + Tasks Window */}
          {isNotFirstPerson && (
            <ActionBar
              runningTaskCount={activeTaskCount}
              tasksWindowOpen={tasksWindowOpen}
              onToggleTasksWindow={() => setTasksWindowOpen((prev) => !prev)}
              isCreatorMode={isCreatorMode}
              onToggleCreatorMode={toggleCreatorMode}
              isAdmin={true}
            />
          )}
          {isNotFirstPerson && tasksWindowOpen && (
            <TasksWindow onClose={() => setTasksWindowOpen(false)} />
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-[25] p-2 rounded-lg backdrop-blur-md bg-white/60 hover:bg-white/80 border border-gray-200/50 shadow-sm text-gray-600 hover:text-gray-900 transition-all opacity-60 hover:opacity-100"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          {/* Creator Mode Bottom Bar — replaces floating PropBrowser */}
          {isCreatorMode && isNotFirstPerson && <CreatorBottomBar />}

          {/* Creator Mode status bar */}
          {isCreatorMode && (
            <div
              style={{
                position: 'absolute',
                top: '100px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(8px)',
                borderRadius: '10px',
                padding: '8px 16px',
                color: '#e2e8f0',
                fontSize: '12px',
                border: '1px solid rgba(255,215,0,0.4)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ color: 'gold', fontWeight: 600 }}>✏️ Creator Mode</span>
              {selectedPropId && (
                <>
                  <span style={{ color: '#94a3b8' }}>·</span>
                  <span style={{ color: '#00ffcc' }}>🎯 Placing...</span>
                </>
              )}
              <button
                onClick={toggleCreatorMode}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '2px 8px',
                }}
              >
                ✕ Exit [E]
              </button>
            </div>
          )}

          {/* Controls hint */}
          {focusState.level !== 'bot' &&
            focusState.level !== 'room' &&
            isNotFirstPerson &&
            !isFullscreen && (
              <div className="absolute top-4 right-16 z-20">
                <div className="text-xs px-3 py-1.5 rounded-lg backdrop-blur-md text-gray-700 bg-white/60 border border-gray-200/50 shadow-sm space-y-0.5">
                  <div>🖱️ Drag: Rotate · Scroll: Zoom · Right-drag: Pan</div>
                  <div>⌨️ WASD: Move · QE: Rotate · Shift: Fast</div>
                  <div className="text-gray-400">
                    🐛 F2: Grid · F3: Lighting · F4: Debug Bots · F5: Demo
                  </div>
                </div>
              </div>
            )}

          {/* Room Info Panel */}
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

          {/* Project Docs Panel */}
          {docsPanel && (
            <ProjectDocsPanel
              projectId={docsPanel.projectId}
              projectName={docsPanel.projectName}
              projectColor={docsPanel.projectColor}
              onClose={() => setDocsPanel(null)}
            />
          )}

          {/* Bot Quick Actions */}
          {focusState.level === 'bot' &&
            focusState.focusedBotKey &&
            focusedSession &&
            focusedBotConfig && (
              <BotQuickActions
                session={focusedSession}
                displayName={
                  displayNames.get(focusState.focusedBotKey) ||
                  getSessionDisplayName(focusedSession, null)
                }
                botConfig={focusedBotConfig}
                canChat={/^agent:[a-zA-Z0-9_-]+:main$/.test(focusedSession.key)}
                onOpenLog={(session) => {
                  setSelectedSession(session)
                  setLogViewerOpen(true)
                }}
              />
            )}

          {/* Bot Info Panel */}
          {focusState.level === 'bot' &&
            focusState.focusedBotKey &&
            focusedSession &&
            focusedBotConfig && (
              <BotInfoPanel
                session={focusedSession}
                displayName={
                  displayNames.get(focusState.focusedBotKey) ||
                  getSessionDisplayName(focusedSession, null)
                }
                botConfig={focusedBotConfig}
                status={focusedBotStatus}
                bio={focusedBotBio}
                agentId={focusedAgentId}
                currentRoomId={getRoomForSession(focusedSession.key, {
                  label: focusedSession.label,
                  model: focusedSession.model,
                  channel: focusedSession.lastChannel,
                })}
                onClose={() => goBack()}
                onOpenLog={(session) => {
                  setSelectedSession(session)
                  setLogViewerOpen(true)
                }}
                onAssignmentChanged={refreshRooms}
                onBioUpdated={refreshAgents}
              />
            )}

          {/* Agent Top Bar */}
          <AgentTopBar
            sessions={allSessions}
            getBotConfig={getBotConfigFromSession}
            getRoomForSession={getRoomForSession}
            defaultRoomId={rooms[0]?.id}
            isActivelyRunning={isActivelyRunning}
            displayNames={displayNames}
            rooms={rooms}
            agentRuntimes={agentRuntimesForPanel}
          />

          <DragStatusIndicator />

          {/* Room Tabs Bar (bottom) - hidden in Creator Mode */}
          {isNotFirstPerson && !isCreatorMode && (
            <RoomTabsBar
              rooms={rooms}
              roomBotCounts={new Map()}
              parkingBotCount={parkingSessions.length}
            />
          )}

          <LightingDebugPanel />
          <DebugPanel />

          <LogViewer
            session={selectedSession}
            open={logViewerOpen}
            onOpenChange={setLogViewerOpen}
          />

          {isDemoMode && isNotFirstPerson && (
            <DemoMeetingButton
              onClick={startDemoMeeting}
              isActive={isDemoMeetingActive}
              isComplete={meetingState.phase === 'complete'}
            />
          )}

          <MeetingOverlays agentRuntimes={agentRuntimesForPanel} rooms={rooms} />

          {taskBoardContext && (
            <TaskBoardOverlay
              open={taskBoardOpen}
              onOpenChange={setTaskBoardOpen}
              projectId={taskBoardContext.projectId}
              roomId={taskBoardContext.roomId}
              agents={taskBoardContext.agents}
            />
          )}
          <HQTaskBoardOverlay open={hqBoardOpen} onOpenChange={setHqBoardOpen} />
        </div>
      </DragDropProvider>
    </TaskBoardProvider>
  )
}

// ─── Public Export ─────────────────────────────────────────────

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

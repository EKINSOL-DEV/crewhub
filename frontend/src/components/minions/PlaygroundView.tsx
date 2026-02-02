import { useState, useRef, useMemo, useEffect, useCallback } from "react"
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, type DragStartEvent, type DragEndEvent } from "@dnd-kit/core"
import { RoomContainer } from "./RoomContainer"
import { LogViewer } from "./LogViewer"
import { ParkingLane } from "./ParkingLane"
import { API_BASE, type MinionSession } from "@/lib/api"
import type { MinionsSettings } from "./SettingsPanel"
import { getMinionType, shouldBeInParkingLane } from "@/lib/minionUtils"
import { checkKonamiCode, triggerDance, playSound } from "@/lib/easterEggs"
import { useToast } from "@/hooks/use-toast"
import { MinionSVGWithIcon } from "./MinionSVGWithIcon"
import { useAgentsRegistry, type AgentRuntime } from "@/hooks/useAgentsRegistry"
import { useRooms } from "@/hooks/useRooms"
import { getRoomForSession as getRoomForSessionFromConfig, loadRoomsConfig } from "@/lib/roomsConfig"

interface PlaygroundViewProps {
  sessions: MinionSession[]
  onAliasChanged?: () => void
  settings: MinionsSettings
}

function getVariantFromColor(color: string): "orange" | "blue" | "green" | "purple" | "amber" | "pink" | "cyan" {
  if (color.includes("FFA726")) return "orange"
  if (color.includes("42A5F5")) return "blue"
  if (color.includes("66BB6A")) return "green"
  if (color.includes("AB47BC")) return "purple"
  if (color.includes("FFCA28")) return "amber"
  if (color.includes("EC407A")) return "pink"
  if (color.includes("29B6F6")) return "cyan"
  return "orange"
}

function getAgentIcon(session: MinionSession): "crab" | "clock" | "camera" | "wave" | "gear" | "default" {
  const key = session.key || ""
  if (key === "agent:main:main") return "crab"
  if (key.includes(":cron:")) return "clock"
  if (key.includes(":spawn:") || key.includes(":subagent:")) return "gear"
  if (key.toLowerCase().includes("creator")) return "camera"
  if (key.toLowerCase().includes("flowy")) return "wave"
  return "default"
}

export function PlaygroundView({ sessions, onAliasChanged, settings }: PlaygroundViewProps) {
  const { toast } = useToast()
  const containerRef = useRef<HTMLDivElement>(null)
  const minionRefs = useRef<HTMLDivElement[]>([])
  const [selectedSession, setSelectedSession] = useState<MinionSession | null>(null)
  const [logViewerOpen, setLogViewerOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<MinionSession | null>(null)
  const [activeAgent, setActiveAgent] = useState<AgentRuntime | null>(null)
  const [isDraggingAgent, setIsDraggingAgent] = useState(false)

  const { agents: agentRuntimes, refresh: refreshAgents } = useAgentsRegistry(true)
  const { rooms, getRoomForSession, isLoading: roomsLoading, refresh: refreshRooms } = useRooms()
  const roomsConfig = useMemo(() => loadRoomsConfig(), [])
  const tokenTrackingRef = useRef<Map<string, { previousTokens: number; lastChangeTime: number }>>(new Map())
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  
  useEffect(() => {
    const now = Date.now()
    const tracking = tokenTrackingRef.current
    sessions.forEach(session => {
      const currentTokens = session.totalTokens || 0
      const tracked = tracking.get(session.key)
      if (!tracked) tracking.set(session.key, { previousTokens: currentTokens, lastChangeTime: now })
      else if (tracked.previousTokens !== currentTokens) tracking.set(session.key, { previousTokens: currentTokens, lastChangeTime: now })
    })
    const currentKeys = new Set(sessions.map(s => s.key))
    for (const key of tracking.keys()) { if (!currentKeys.has(key)) tracking.delete(key) }
  }, [sessions])
  
  const isActivelyRunning = useCallback((sessionKey: string): boolean => {
    const tracked = tokenTrackingRef.current.get(sessionKey)
    if (!tracked) return false
    return Date.now() - tracked.lastChangeTime < 30000
  }, [])
  
  const assignSessionToRoom = useCallback(async (sessionKey: string, roomId: string) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${encodeURIComponent(sessionKey)}/room`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: roomId }) })
      return response.ok
    } catch { return false }
  }, [])

  const updateAgentRoom = useCallback(async (agentId: string, roomId: string) => {
    try {
      const response = await fetch(`${API_BASE}/agents/${agentId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ default_room_id: roomId }) })
      return response.ok
    } catch { return false }
  }, [])
  
  useEffect(() => {
    if (!settings.easterEggsEnabled) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (checkKonamiCode(event)) {
        const elements = minionRefs.current.filter(Boolean)
        if (elements.length > 0) {
          triggerDance(elements)
          if (settings.playSound) playSound("konami", 0.3)
          toast({ title: "🎉 Konami Code Activated!", description: "Crew going wild! 🎪🎉" })
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [settings.easterEggsEnabled, settings.playSound, toast])

  const activeSessions = sessions.filter(s => !shouldBeInParkingLane(s, isActivelyRunning(s.key)))
  const parkingSessions = sessions.filter(s => shouldBeInParkingLane(s, isActivelyRunning(s.key)))
  const sortedActiveSessions = [...activeSessions].sort((a, b) => b.updatedAt - a.updatedAt)
  const sortedParkingSessions = [...parkingSessions].sort((a, b) => b.updatedAt - a.updatedAt)
  const visibleSessions = sortedActiveSessions.slice(0, 15)
  
  const itemsByRoom = useMemo(() => {
    const grouped = new Map<string, { agents: AgentRuntime[]; orphanSessions: MinionSession[] }>()
    rooms.forEach(room => grouped.set(room.id, { agents: [], orphanSessions: [] }))
    agentRuntimes.forEach(runtime => {
      const roomId = runtime.agent.default_room_id || rooms[0]?.id || "default"
      const existing = grouped.get(roomId)
      if (existing) existing.agents.push(runtime)
      else grouped.set(roomId, { agents: [runtime], orphanSessions: [] })
    })
    const agentSessionKeys = new Set(agentRuntimes.map(r => r.agent.agent_session_key).filter(Boolean))
    const orphanSessions = visibleSessions.filter(session => {
      const isAgentMain = agentSessionKeys.has(session.key)
      const isAgentChild = agentRuntimes.some(runtime => runtime.childSessions.some(child => child.key === session.key))
      return !isAgentMain && !isAgentChild
    })
    orphanSessions.forEach(session => {
      const assignedRoomId = getRoomForSession(session.key)
      const targetRoomId = assignedRoomId || getRoomForSessionFromConfig(session.key, roomsConfig, { label: session.label, model: session.model })
      const existing = grouped.get(targetRoomId)
      if (existing) existing.orphanSessions.push(session)
      else {
        const fallbackRoomId = rooms[0]?.id || "default"
        const fallback = grouped.get(fallbackRoomId)
        if (fallback) fallback.orphanSessions.push(session)
      }
    })
    return grouped
  }, [agentRuntimes, visibleSessions, rooms, getRoomForSession, roomsConfig])

  const handleMinionClick = (session: MinionSession) => { setSelectedSession(session); setLogViewerOpen(true) }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragId = event.active.id as string
    setActiveId(dragId)
    if (dragId.startsWith("agent:")) {
      const agentId = dragId.replace("agent:", "")
      const agent = agentRuntimes.find(r => r.agent.id === agentId)
      setActiveAgent(agent || null)
      setIsDraggingAgent(true)
    } else {
      const session = visibleSessions.find(s => s.key === dragId)
      setActiveSession(session || null)
      setIsDraggingAgent(false)
    }
  }, [agentRuntimes, visibleSessions])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setActiveSession(null)
    setActiveAgent(null)
    setIsDraggingAgent(false)
    if (!over) return
    const dragId = active.id as string
    const targetRoomId = over.id as string

    if (dragId.startsWith("agent:")) {
      const agentId = dragId.replace("agent:", "")
      const agent = agentRuntimes.find(r => r.agent.id === agentId)
      if (!agent || agent.agent.default_room_id === targetRoomId) return
      const success = await updateAgentRoom(agentId, targetRoomId)
      if (success) {
        refreshAgents()
        const roomName = rooms.find(r => r.id === targetRoomId)?.name || targetRoomId
        toast({ title: "🏢 Agent Relocated!", description: `${agent.agent.name} moved to ${roomName}` })
      } else toast({ title: "Failed to move agent", description: "Could not update agent room", variant: "destructive" })
    } else {
      const sessionKey = dragId
      const success = await assignSessionToRoom(sessionKey, targetRoomId)
      if (success) {
        refreshRooms()
        const roomName = rooms.find(r => r.id === targetRoomId)?.name || targetRoomId
        toast({ title: "🚚 Session Moved!", description: `Assigned to ${roomName}` })
      } else toast({ title: "Failed to move session", description: "Could not assign session to room", variant: "destructive" })
    }
  }, [agentRuntimes, rooms, updateAgentRoom, assignSessionToRoom, toast, refreshAgents, refreshRooms])

  if (roomsLoading || rooms.length === 0) {
    return (<div className="flex items-center justify-center w-full h-full min-h-[600px]" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" }}><div className="text-white/60 text-sm">Loading rooms...</div></div>)
  }

  return (
    <>
      <div className="flex w-full h-full" style={{ minHeight: "600px" }}>
        <div ref={containerRef} className="relative flex-1 overflow-auto" style={{ width: "85%", background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)", backgroundImage: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%), repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.03) 10px, rgba(255,255,255,.03) 20px)" }}>
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg width="100%" height="100%"><defs><pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="2" fill="white" /></pattern></defs><rect width="100%" height="100%" fill="url(#dots)" /></svg>
          </div>
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-50">
            <div className="text-sm text-white text-center px-4 py-2 rounded-full" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)" }}>
              {agentRuntimes.length} agents · {visibleSessions.length} active{sortedParkingSessions.length > 0 && ` · ${sortedParkingSessions.length} parked`} · Click for details
            </div>
          </div>
          {agentRuntimes.length === 0 && visibleSessions.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-[100]">
              <div className="text-center"><div className="text-6xl mb-4">💤</div><p className="text-white text-xl font-semibold" style={{ textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>No agents or sessions</p><p className="text-white/80 text-sm mt-2">Agents will appear when they're defined!</p></div>
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="grid gap-4 p-4 h-full w-full" style={{ gridTemplateColumns: "repeat(4, 1fr)", gridAutoRows: "minmax(300px, 1fr)" }}>
              {[...rooms].sort((a, b) => a.sort_order - b.sort_order).map((room, roomIndex) => {
                const items = itemsByRoom.get(room.id) || { agents: [], orphanSessions: [] }
                return (<RoomContainer key={room.id} room={room} agents={items.agents} orphanSessions={items.orphanSessions} settings={settings} showLabel={true} showBorder={true} onMinionClick={handleMinionClick} onAliasChanged={onAliasChanged} minionRefs={minionRefs} roomIndex={roomIndex} isDragOver={activeId !== null} />)
              })}
            </div>
            <DragOverlay dropAnimation={null}>
              {activeId && (isDraggingAgent ? activeAgent : activeSession) && (
                <div style={{ cursor: "grabbing", opacity: 0.9, transform: "scale(1.1)" }}>
                  {isDraggingAgent && activeAgent ? (
                    <div className="text-center"><MinionSVGWithIcon variant="blue" agentIcon="crab" size={120} flipped={false} animDelay={0} /><div className="text-white text-sm font-semibold mt-2">{activeAgent.agent.name}</div></div>
                  ) : activeSession ? (
                    <MinionSVGWithIcon variant={getVariantFromColor(getMinionType(activeSession).color)} agentIcon={getAgentIcon(activeSession)} size={activeSession.key.includes(":subagent:") ? 72 : 120} flipped={false} animDelay={0} />
                  ) : null}
                </div>
              )}
            </DragOverlay>
          </DndContext>
          <div className="absolute bottom-16 right-4 z-40"><div className="text-xs text-white/60 italic px-3 py-1 rounded" style={{ background: "rgba(0,0,0,0.2)", fontFamily: "Comic Sans MS, cursive, sans-serif" }}>🍌 Banana-powered workforce</div></div>
        </div>
        <div className="h-full" style={{ width: "15%" }}><ParkingLane sessions={sortedParkingSessions} onMinionClick={handleMinionClick} /></div>
      </div>
      <LogViewer session={selectedSession} open={logViewerOpen} onOpenChange={setLogViewerOpen} />
    </>
  )
}

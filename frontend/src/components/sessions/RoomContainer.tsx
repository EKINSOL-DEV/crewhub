import { useRef, useEffect, useState, useCallback } from "react"
import { useDroppable } from "@dnd-kit/core"
import { PlaygroundSession } from "./PlaygroundSession"
import { AgentAnchor } from "./AgentAnchor"
import type { MinionSession } from "@/lib/api"
import type { Room } from "@/hooks/useRooms"
import type { AgentRuntime } from "@/hooks/useAgentsRegistry"
import type { MinionsSettings } from "./SettingsPanel"
import { useTheme } from "@/contexts/ThemeContext"

interface Position { x: number; y: number }

interface RoomContainerProps {
  room: Room
  agents: AgentRuntime[]
  orphanSessions: MinionSession[]
  settings: MinionsSettings
  showLabel: boolean
  showBorder: boolean
  onMinionClick?: (session: MinionSession) => void
  onAliasChanged?: () => void
  minionRefs?: React.MutableRefObject<HTMLDivElement[]>
  roomIndex?: number
  isDragOver?: boolean
}

export function RoomContainer({
  room, agents, orphanSessions, settings, showLabel, showBorder, onMinionClick, onAliasChanged, minionRefs, roomIndex = 0, isDragOver: _isDragOver = false
}: RoomContainerProps) {
  const { resolvedMode } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const positionsRef = useRef<Record<string, Position>>({})
  const totalItems = agents.length + orphanSessions.length
  const { setNodeRef, isOver, active } = useDroppable({ id: room.id })
  
  // Don't show scale effect if dragging FROM this room (prevents "room dragging" visual bug)
  const isDraggingFromThisRoom = active && (() => {
    const dragId = active.id as string
    // Check if the dragged item belongs to this room
    const isAgentFromHere = agents.some(a => `agent:${a.agent.id}` === dragId)
    const isSessionFromHere = orphanSessions.some(s => s.key === dragId) || 
      agents.some(a => a.childSessions.some(cs => cs.key === dragId))
    return isAgentFromHere || isSessionFromHere
  })()
  
  useEffect(() => {
    if (!containerRef.current) return
    const updateSize = () => {
      if (containerRef.current) setContainerSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight })
    }
    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])
  
  const updatePosition = useCallback((key: string, x: number, y: number) => {
    const current = positionsRef.current[key]
    if (current && Math.abs(current.x - x) < 1 && Math.abs(current.y - y) < 1) return
    positionsRef.current[key] = { x, y }
  }, [])
  
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node
    setNodeRef(node)
  }, [setNodeRef])

  // Only show drop highlight when item is directly hovering over THIS room (and not from this room)
  const showDropHighlight = isOver && !isDraggingFromThisRoom

  return (
    <div ref={combinedRef} role="region" aria-label={`${room.name} - ${totalItems} item${totalItems !== 1 ? 's' : ''}`}
      className="relative overflow-hidden rounded-lg transition-[background-color,border-color,box-shadow,transform] duration-200" style={{
        backgroundColor: (isOver && !isDraggingFromThisRoom) ? `${room.color || "#4f46e5"}30` : showBorder ? `${room.color || "#4f46e5"}10` : "transparent",
        border: (isOver && !isDraggingFromThisRoom) ? `3px dashed ${room.color || "#4f46e5"}` : showDropHighlight && showBorder ? `2px dashed ${room.color || "#4f46e5"}60` : showBorder ? `2px solid ${room.color || "#4f46e5"}40` : "none",
        minHeight: "300px", transform: (isOver && !isDraggingFromThisRoom) ? "scale(1.02)" : "scale(1)", boxShadow: (isOver && !isDraggingFromThisRoom) ? `0 0 20px ${room.color || "#4f46e5"}40` : "none"
      }}>
      {showLabel && (
        <div className="absolute top-3 left-3 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg" style={{ backgroundColor: `${room.color || "#4f46e5"}20`, color: room.color || "#4f46e5", border: `1px solid ${room.color || "#4f46e5"}60`, backdropFilter: "blur(8px)" }}>
          {room.icon && <span className="text-lg">{room.icon}</span>}
          <span>{room.name}</span>
          <span className="text-xs opacity-70">({totalItems})</span>
        </div>
      )}
      
      <div className="relative w-full h-full">
        {agents.map((runtime, index) => {
          const globalIndex = roomIndex * 100 + index
          const agentPosKey = `agent:${runtime.agent.agent_session_key || runtime.agent.id}`
          return (
            <div key={runtime.agent.id}>
              <AgentAnchor ref={(el) => { if (el && minionRefs) minionRefs.current[globalIndex] = el }}
                runtime={runtime} containerWidth={containerSize.width} containerHeight={containerSize.height} index={index}
                onPositionUpdate={(x, y) => updatePosition(agentPosKey, x, y)} speedMultiplier={settings.playgroundSpeed} easterEggsEnabled={settings.easterEggsEnabled}
                onClick={runtime.session ? () => onMinionClick?.(runtime.session!) : undefined} />
              {runtime.childSessions.map((childSession, childIndex) => {
                const childGlobalIndex = globalIndex + 1000 + childIndex
                const parentPosition = positionsRef.current[agentPosKey]
                return (
                  <PlaygroundSession key={childSession.key} ref={(el) => { if (el && minionRefs) minionRefs.current[childGlobalIndex] = el }}
                    session={childSession} containerWidth={containerSize.width} containerHeight={containerSize.height}
                    onMinionClick={() => onMinionClick?.(childSession)} onAliasChanged={onAliasChanged} index={index + childIndex}
                    allSessions={[...orphanSessions, ...agents.flatMap(a => a.childSessions)]} parentPosition={parentPosition}
                    onPositionUpdate={updatePosition} speedMultiplier={settings.playgroundSpeed} playSoundEnabled={settings.playSound} easterEggsEnabled={settings.easterEggsEnabled} />
                )
              })}
            </div>
          )
        })}
        
        {orphanSessions.map((session, index) => {
          const globalIndex = roomIndex * 100 + agents.length * 1000 + index
          return (
            <PlaygroundSession key={session.key} ref={(el) => { if (el && minionRefs) minionRefs.current[globalIndex] = el }}
              session={session} containerWidth={containerSize.width} containerHeight={containerSize.height}
              onMinionClick={() => onMinionClick?.(session)} onAliasChanged={onAliasChanged} index={agents.length + index}
              allSessions={orphanSessions} onPositionUpdate={updatePosition} speedMultiplier={settings.playgroundSpeed}
              playSoundEnabled={settings.playSound} easterEggsEnabled={settings.easterEggsEnabled} />
          )
        })}
      </div>
      
      {totalItems === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`text-center ${resolvedMode === 'dark' ? 'text-white/30' : 'text-foreground/40'}`}>
            <div className="text-4xl mb-2">{room.icon || "📭"}</div>
            <div className="text-sm">No agents or sessions in {room.name}</div>
          </div>
        </div>
      )}
    </div>
  )
}

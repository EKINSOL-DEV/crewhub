import { forwardRef, useEffect, useRef, useState, useCallback } from "react"
import { useDraggable } from "@dnd-kit/core"
import { SessionSVGWithIcon } from "./SessionSVGWithIcon"
import type { AgentRuntime } from "@/hooks/useAgentsRegistry"
import { cn } from "@/lib/utils"
import { getAgentVariant } from "@/lib/agentUtils"

interface AgentAnchorProps {
  runtime: AgentRuntime
  containerWidth: number
  containerHeight: number
  index: number
  onPositionUpdate: (x: number, y: number) => void
  speedMultiplier: number
  easterEggsEnabled: boolean
  onClick?: () => void
}

const STATUS_MESSAGES: Record<string, string> = {
  offline: "💤 Offline",
  idle: "😊 Ready",
  thinking: "🤔 Thinking...",
  working: "⚡ Working...",
}

const STATUS_COLORS = {
  offline: "#64748b",
  idle: "#3b82f6",
  thinking: "#a855f7",
  working: "#22c55e",
}

function getAgentIcon(runtime: AgentRuntime): "crab" | "clock" | "camera" | "wave" | "gear" | "default" {
  const key = runtime.agent.agent_session_key || ""
  if (key === "agent:main:main") return "crab"
  if (key.includes(":cron:")) return "clock"
  if (key.toLowerCase().includes("creator")) return "camera"
  if (key.toLowerCase().includes("flowy")) return "wave"
  return "gear"
}

export const AgentAnchor = forwardRef<HTMLDivElement, AgentAnchorProps>(
  ({ runtime, containerWidth, containerHeight, index, onPositionUpdate, speedMultiplier, onClick }, ref) => {
    const internalRef = useRef<HTMLDivElement>(null)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [targetPosition, setTargetPosition] = useState({ x: 0, y: 0 })
    const animationFrameRef = useRef<number>()
    const [isHovered, setIsHovered] = useState(false)
    const [showBubble, setShowBubble] = useState(false)
    const bubbleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
      if (runtime.status === "working" || runtime.status === "thinking") {
        setShowBubble(true)
      } else if (!isHovered) {
        bubbleTimeoutRef.current = setTimeout(() => setShowBubble(false), 2000)
      }
      return () => { if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current) }
    }, [runtime.status, isHovered])

    const handleMouseEnter = useCallback(() => {
      setIsHovered(true)
      setShowBubble(true)
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current)
    }, [])

    const handleMouseLeave = useCallback(() => {
      setIsHovered(false)
      bubbleTimeoutRef.current = setTimeout(() => {
        if (runtime.status !== "working" && runtime.status !== "thinking") setShowBubble(false)
      }, 1000)
    }, [runtime.status])

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ 
      id: `agent:${runtime.agent.id}`,
      data: { type: 'agent', agentId: runtime.agent.id, agentName: runtime.agent.name }
    })

    const combinedRef = (node: HTMLDivElement | null) => {
      if (internalRef.current !== node) (internalRef as React.MutableRefObject<HTMLDivElement | null>).current = node
      setNodeRef(node)
      if (typeof ref === "function") ref(node)
      else if (ref && node) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }

    const initializedRef = useRef(false)
    useEffect(() => {
      if (containerWidth === 0 || containerHeight === 0) return
      if (initializedRef.current) return
      initializedRef.current = true
      const margin = 80
      const x = margin + Math.random() * (containerWidth - margin * 2)
      const y = margin + Math.random() * (containerHeight - margin * 2)
      setPosition({ x, y })
      setTargetPosition({ x, y })
      onPositionUpdate(x, y)
    }, [containerWidth, containerHeight, onPositionUpdate])

    useEffect(() => {
      if (containerWidth === 0 || containerHeight === 0) return
      const pickNewTarget = () => {
        const margin = 80
        setTargetPosition({ x: margin + Math.random() * (containerWidth - margin * 2), y: margin + Math.random() * (containerHeight - margin * 2) })
      }
      const interval = setInterval(pickNewTarget, 3000 + Math.random() * 5000)
      const initialTimeout = setTimeout(pickNewTarget, 500 + Math.random() * 1000)
      return () => { clearInterval(interval); clearTimeout(initialTimeout) }
    }, [containerWidth, containerHeight])

    useEffect(() => {
      const animate = () => {
        setPosition(prev => {
          const dx = targetPosition.x - prev.x
          const dy = targetPosition.y - prev.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < 2) return prev
          const baseSpeed = runtime.status === "working" ? 1.2 : 0.6
          const speed = baseSpeed * speedMultiplier
          const moveX = (dx / distance) * speed
          const moveY = (dy / distance) * speed
          const newX = prev.x + moveX
          const newY = prev.y + moveY
          onPositionUpdate(newX, newY)
          return { x: newX, y: newY }
        })
        animationFrameRef.current = requestAnimationFrame(animate)
      }
      animationFrameRef.current = requestAnimationFrame(animate)
      return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) }
    }, [targetPosition, speedMultiplier, onPositionUpdate, runtime.status])

    const isOffline = runtime.status === "offline"
    const statusColor = STATUS_COLORS[runtime.status]

    const getBubbleContent = () => {
      const statusMsg = STATUS_MESSAGES[runtime.status] || "Ready"
      const childCount = runtime.childSessions.length
      if (childCount > 0) return `${statusMsg}\n👥 ${childCount} worker${childCount > 1 ? 's' : ''}`
      return statusMsg
    }

    return (
      <div ref={combinedRef} className={cn("absolute cursor-grab transition-opacity duration-200", isDragging && "opacity-50", isOffline && "opacity-60")}
        style={{ left: position.x, top: position.y, transform: "translate(-50%, -50%)", zIndex: isDragging ? 1000 : (isHovered ? 150 : 100), touchAction: "none" }}
        onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={isDragging ? undefined : onClick} {...listeners} {...attributes}>
        {showBubble && (
          <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%) translateY(-10px)", animation: "bubblePop 0.3s ease-out", zIndex: 200, pointerEvents: "none" }}>
            <div className="relative px-4 py-2 rounded-2xl max-w-[180px] text-sm bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-100 shadow-lg" style={{ fontFamily: "Comic Sans MS, cursive, sans-serif" }}>
              <div className="text-center font-medium text-gray-900 dark:text-gray-100 whitespace-pre-line">{getBubbleContent()}</div>
              <div style={{ position: "absolute", bottom: "-8px", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "8px solid white" }} />
            </div>
          </div>
        )}
        <div className="relative">
          <SessionSVGWithIcon variant={getAgentVariant(runtime.agent.id)} agentIcon={getAgentIcon(runtime)} size={120} flipped={false} animDelay={index * 0.1} />
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: "white", border: `1px solid ${statusColor}` }}>
            {runtime.agent.name}
          </div>
          {runtime.childSessions.length > 0 && (
            <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-full bg-indigo-500 text-white text-xs font-bold flex items-center justify-center border-2 border-white" title={`${runtime.childSessions.length} child session${runtime.childSessions.length !== 1 ? 's' : ''}`}>
              {runtime.childSessions.length}
            </div>
          )}
        </div>
      </div>
    )
  }
)

AgentAnchor.displayName = "AgentAnchor"

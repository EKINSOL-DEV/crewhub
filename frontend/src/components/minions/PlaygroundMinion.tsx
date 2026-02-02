import { useState, useEffect, useRef, forwardRef } from "react"
import { useDraggable } from "@dnd-kit/core"
import { MinionSVGWithIcon } from "./MinionSVGWithIcon"
import type { MinionSession } from "@/lib/api"
import { getSessionStatus, getMinionType, getSessionDisplayName, formatModel, getTaskEmoji } from "@/lib/minionUtils"
import { getPersonalityStatus } from "@/lib/personality"
import { isSubagent, findParentSession } from "@/lib/sessionUtils"
import { playSound, getClickMessage } from "@/lib/easterEggs"
import { useToast } from "@/hooks/use-toast"
import { getMinionName } from "@/lib/friendlyNames"
import { getRoomForSession, loadRoomsConfig } from "@/lib/roomsConfig"

type MinionVariant = "orange" | "blue" | "green" | "purple" | "amber" | "pink" | "cyan"
type AgentIcon = "crab" | "clock" | "camera" | "wave" | "gear" | "default"

interface Position { x: number; y: number }

interface PlaygroundMinionProps {
  session: MinionSession
  containerWidth: number
  containerHeight: number
  onMinionClick?: () => void
  onAliasChanged?: () => void
  index: number
  allSessions: MinionSession[]
  parentPosition?: Position
  onPositionUpdate?: (sessionKey: string, x: number, y: number) => void
  speedMultiplier?: number
  playSoundEnabled?: boolean
  easterEggsEnabled?: boolean
}

function getVariantFromColor(color: string): MinionVariant {
  if (color.includes("FFA726")) return "orange"
  if (color.includes("42A5F5")) return "blue"
  if (color.includes("66BB6A")) return "green"
  if (color.includes("AB47BC")) return "purple"
  if (color.includes("FFCA28")) return "amber"
  if (color.includes("EC407A")) return "pink"
  if (color.includes("29B6F6")) return "cyan"
  return "orange"
}

function getAgentIcon(session: MinionSession): AgentIcon {
  const key = session.key || ""
  if (key === "agent:main:main") return "crab"
  if (key.includes(":cron:")) return "clock"
  if (key.includes(":spawn:") || key.includes(":subagent:")) return "gear"
  if (key.toLowerCase().includes("creator")) return "camera"
  if (key.toLowerCase().includes("flowy")) return "wave"
  return "default"
}

export const PlaygroundMinion = forwardRef<HTMLDivElement, PlaygroundMinionProps>(function PlaygroundMinion({
  session, containerWidth, containerHeight, onMinionClick, index, allSessions, parentPosition, onPositionUpdate, speedMultiplier = 1.0, playSoundEnabled = false, easterEggsEnabled = true
}, ref) {
  const { toast } = useToast()
  const status = getSessionStatus(session)
  const minionType = getMinionType(session)
  const variant = getVariantFromColor(minionType.color)
  const agentIcon = getAgentIcon(session)
  const displayName = getSessionDisplayName(session)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: session.key })
  const isSub = isSubagent(session.key)
  const _parentSession = isSub ? findParentSession(session.key, allSessions) : null
  const hasParent = isSub && parentPosition !== undefined
  void _parentSession
  const minionSize = isSub ? 72 : 120
  
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })
  const [targetPosition, setTargetPosition] = useState<Position>({ x: 0, y: 0 })
  const [orbitAngle, setOrbitAngle] = useState<number>(Math.random() * Math.PI * 2)
  const [isHovered, setIsHovered] = useState(false)
  const [showBubble, setShowBubble] = useState(false)
  const [clickCount, setClickCount] = useState(0)
  const [isSpawning, setIsSpawning] = useState(true)
  const animationFrameRef = useRef<number | null>(null)
  const lastTargetUpdateRef = useRef<number>(Date.now())
  const lastPositionUpdateRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 })
  const bubbleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setIsSpawning(false), 800 + index * 100)
    return () => clearTimeout(timer)
  }, [index])

  // Cleanup all timeout refs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current)
      if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    const margin = minionSize / 2 + 10
    let initialX, initialY
    if (hasParent && parentPosition) {
      const spawnDistance = 60
      const randomAngle = Math.random() * Math.PI * 2
      initialX = Math.max(margin, Math.min(containerWidth - margin, parentPosition.x + Math.cos(randomAngle) * spawnDistance))
      initialY = Math.max(margin, Math.min(containerHeight - margin, parentPosition.y + Math.sin(randomAngle) * spawnDistance))
    } else {
      initialX = Math.random() * (containerWidth - margin * 2) + margin
      initialY = Math.random() * (containerHeight - margin * 2) + margin
    }
    setPosition({ x: initialX, y: initialY })
    setTargetPosition({ x: initialX, y: initialY })
    if (onPositionUpdate) onPositionUpdate(session.key, initialX, initialY)
  }, [containerWidth, containerHeight, minionSize, session.key, onPositionUpdate, hasParent, parentPosition])
  
  useEffect(() => {
    if (!onPositionUpdate) return
    const now = Date.now()
    const last = lastPositionUpdateRef.current
    if (now - last.time > 100 || Math.abs(position.x - last.x) > 5 || Math.abs(position.y - last.y) > 5) {
      onPositionUpdate(session.key, position.x, position.y)
      lastPositionUpdateRef.current = { x: position.x, y: position.y, time: now }
    }
  }, [position, session.key, onPositionUpdate])

  useEffect(() => {
    if (status === "sleeping") return
    if (containerWidth === 0 || containerHeight === 0) return
    const margin = minionSize / 2 + 10
    const targetUpdateInterval = (status === "active" ? 2000 : 4000) / speedMultiplier
    
    const animate = () => {
      const now = Date.now()
      if (hasParent) setOrbitAngle(prev => prev + (status === "active" ? 0.02 : 0.01) * speedMultiplier)
      if (!hasParent && now - lastTargetUpdateRef.current > targetUpdateInterval) {
        setTargetPosition({ x: Math.random() * (containerWidth - margin * 2) + margin, y: Math.random() * (containerHeight - margin * 2) + margin })
        lastTargetUpdateRef.current = now
      }
      setPosition(prev => {
        if (hasParent && parentPosition) {
          const orbitRadius = 80 + (index % 3) * 20
          const targetX = parentPosition.x + Math.cos(orbitAngle) * orbitRadius
          const targetY = parentPosition.y + Math.sin(orbitAngle) * orbitRadius
          const dx = targetX - prev.x, dy = targetY - prev.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < 2) return prev
          const speed = 2.5 * speedMultiplier
          return { x: prev.x + (dx / distance) * speed, y: prev.y + (dy / distance) * speed }
        } else {
          const dx = targetPosition.x - prev.x, dy = targetPosition.y - prev.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          if (distance < 2) return prev
          const speed = (status === "active" ? 1.5 : 0.8) * speedMultiplier
          return { x: prev.x + (dx / distance) * speed, y: prev.y + (dy / distance) * speed }
        }
      })
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    animationFrameRef.current = requestAnimationFrame(animate)
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) }
  }, [status, containerWidth, containerHeight, hasParent, parentPosition, orbitAngle, targetPosition, index, speedMultiplier, minionSize])

  useEffect(() => {
    if (status === "active" && !isHovered) {
      setShowBubble(true)
      const toggleInterval = setInterval(() => { setShowBubble(false); setTimeout(() => setShowBubble(true), 1500) }, 15000 + Math.random() * 10000)
      return () => clearInterval(toggleInterval)
    } else if (status !== "active") setShowBubble(false)
  }, [status, isHovered])

  const getBubbleContent = () => {
    const personality = getPersonalityStatus(minionType.type, status)
    const roomsConfig = loadRoomsConfig()
    const roomId = getRoomForSession(session.key, roomsConfig, { label: session.label, model: session.model })
    const minionName = getMinionName(session.key, roomId)
    if (status === "active") {
      if (session.label) {
        const emoji = getTaskEmoji(session.label)
        return (<div className="space-y-1"><div className="font-bold text-base">{minionName} {emoji}</div><div className="text-xs opacity-80">{session.label.replace(/-/g, ' ')}</div></div>)
      }
      const emoji = getTaskEmoji(session.label)
      let taskLabel = "Working..."
      if (session.key?.includes(":cron:")) taskLabel = "Scheduled task"
      if (session.key?.includes(":subagent:")) taskLabel = "Processing"
      return (<div className="space-y-1"><div className="font-bold text-base">{minionName} {emoji}</div><div className="text-xs opacity-80">{taskLabel}</div></div>)
    }
    if (personality) return (<div className="space-y-1"><div className="font-bold text-base">{minionName}</div><div className="text-xs opacity-80">{personality}</div></div>)
    const fallbackInfo = session.model ? `Ready (${formatModel(session.model)})` : minionType.type
    return (<div className="space-y-1"><div className="font-bold text-base">{minionName}</div><div className="text-xs opacity-80">{fallbackInfo}</div></div>)
  }

  const handleMouseEnter = () => { setIsHovered(true); setShowBubble(true); if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current) }
  const handleMouseLeave = () => { setIsHovered(false); if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current); bubbleTimeoutRef.current = setTimeout(() => setShowBubble(false), 1000) }
  
  const handleAvatarClick = (e: React.MouseEvent) => {
    onMinionClick?.()
    if (!easterEggsEnabled) return
    e.stopPropagation()
    const newCount = clickCount + 1
    setClickCount(newCount)
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current)
    clickTimeoutRef.current = setTimeout(() => setClickCount(0), 2000)
    if (newCount === 5) {
      const message = getClickMessage()
      if (playSoundEnabled) try { playSound("achievement", 0.2) } catch {}
      toast({ title: message, description: `You found ${displayName}'s secret! 🎉` })
      setClickCount(0)
    }
  }

  const bubbleStyle = status === "sleeping" ? "thought" : "speech"
  const shouldFlip = targetPosition.x < position.x
  const halfSize = minionSize / 2

  return (
    <>
      <div ref={(node) => { setNodeRef(node); if (typeof ref === 'function') ref(node); else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node }}
        {...listeners} {...attributes} role="button" tabIndex={0} aria-label={`${displayName} - ${status}`}
        style={{ position: "absolute", left: position.x - halfSize, top: position.y - halfSize, cursor: isDragging ? "grabbing" : "grab", zIndex: isDragging ? 1000 : (isHovered ? 100 : (isSub ? index + 50 : index)), opacity: isDragging ? 0.5 : (isSpawning ? 0 : 1), transform: isSpawning ? "scale(0.3)" : "scale(1)", animation: isSpawning ? "spawnPop 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)" : undefined, touchAction: "none" }}
        onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={isDragging ? undefined : onMinionClick}>
        {showBubble && (
          <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%) translateY(-10px)", animation: "bubblePop 0.3s ease-out", zIndex: 200, pointerEvents: "none" }}>
            <div className="relative px-4 py-2 rounded-2xl max-w-[200px] text-sm bg-white dark:bg-gray-800 border-2 border-gray-900 dark:border-gray-100 shadow-lg" style={{ borderRadius: bubbleStyle === "thought" ? "50%" : "1rem", fontFamily: "Comic Sans MS, cursive, sans-serif" }} title={session.key}>
              <div className="text-center font-medium text-gray-900 dark:text-gray-100">{getBubbleContent()}</div>
              {bubbleStyle === "speech" && <div style={{ position: "absolute", bottom: "-12px", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: "12px solid", borderTopColor: "inherit" }} />}
            </div>
          </div>
        )}
        <div onClick={handleAvatarClick} style={{ transition: "transform 0.3s ease", transform: isHovered ? "scale(1.1)" : "scale(1)", cursor: easterEggsEnabled ? "pointer" : "default" }}>
          <MinionSVGWithIcon variant={variant} agentIcon={agentIcon} size={minionSize} flipped={shouldFlip} animDelay={index * 0.5} />
        </div>
        {status === "sleeping" && <div style={{ position: "absolute", top: "-10px", right: "10px", fontSize: "24px", animation: "float 2s ease-in-out infinite" }}>💤</div>}
        <div role="status" aria-label={`Status: ${status}`} style={{ position: "absolute", top: "10px", left: "10px", width: "12px", height: "12px", borderRadius: "50%", backgroundColor: status === "active" ? "#4ade80" : status === "idle" ? "#fbbf24" : "#9ca3af", boxShadow: "0 0 8px rgba(0,0,0,0.3)", animation: status === "active" ? "pulse 2s ease-in-out infinite" : undefined }}>
          <span className="sr-only">{status}</span>
        </div>
        <style>{`
          @keyframes spawnPop { 0% { opacity: 0; transform: scale(0); } 50% { opacity: 1; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes float { 0%, 100% { transform: translateY(0); opacity: 0.8; } 50% { transform: translateY(-20px); opacity: 0.3; } }
          @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.7; } }
        `}</style>
      </div>
    </>
  )
})

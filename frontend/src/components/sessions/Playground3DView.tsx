// @ts-nocheck - WIP 3D view, has some unused variables
import { useState, useRef, useMemo, useCallback, Suspense, useEffect } from "react"
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber"
import { OrbitControls, Text, RoundedBox, Float, Html, Sparkles } from "@react-three/drei"
import * as THREE from "three"
import { LogViewer } from "./LogViewer"
import { type MinionSession } from "@/lib/api"
import type { MinionsSettings } from "./SettingsPanel"
import { getMinionType, shouldBeInParkingLane, getSessionDisplayName } from "@/lib/minionUtils"
import { useAgentsRegistry, type AgentRuntime } from "@/hooks/useAgentsRegistry"
import { useRooms, type Room } from "@/hooks/useRooms"
import { getDefaultRoomForSession } from "@/lib/roomsConfig"

interface Playground3DViewProps {
  sessions: MinionSession[]
  onAliasChanged?: () => void
  settings: MinionsSettings
}

// Status colors
const STATUS_COLORS = {
  active: "#4ade80",
  idle: "#fbbf24",
  sleeping: "#9ca3af",
}

// Room platform component with floating label
function RoomPlatform({ 
  room, 
  position, 
  size,
  itemCount
}: { 
  room: Room
  position: [number, number, number]
  size: [number, number, number]
  itemCount: number
}) {
  const color = room.color || "#4f46e5"
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  
  return (
    <group position={position}>
      {/* Platform base */}
      <RoundedBox 
        ref={meshRef}
        args={size} 
        radius={0.2} 
        smoothness={4}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshStandardMaterial 
          color={color} 
          transparent 
          opacity={hovered ? 0.4 : 0.25}
          roughness={0.8}
          metalness={0.1}
        />
      </RoundedBox>
      
      {/* Platform edge glow */}
      <mesh position={[0, -size[1]/2 + 0.05, 0]}>
        <boxGeometry args={[size[0] + 0.1, 0.1, size[2] + 0.1]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>
      
      {/* Grid lines on floor */}
      <gridHelper 
        args={[size[0] - 0.5, 8, color, color]} 
        position={[0, -size[1]/2 + 0.06, 0]}
        rotation={[0, 0, 0]}
      />
      
      {/* Floating label */}
      <Float speed={2} rotationIntensity={0} floatIntensity={0.3}>
        <group position={[0, size[1]/2 + 0.8, 0]}>
          <RoundedBox args={[2.5, 0.5, 0.1]} radius={0.1}>
            <meshStandardMaterial 
              color={color} 
              transparent 
              opacity={0.9}
              emissive={color}
              emissiveIntensity={0.2}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.06]}
            fontSize={0.2}
            color="white"
            anchorX="center"
            anchorY="middle"
            font="/fonts/Inter-Bold.woff"
          >
            {room.icon} {room.name} ({itemCount})
          </Text>
        </group>
      </Float>
      
      {/* Ambient room light */}
      <pointLight 
        position={[0, 2, 0]} 
        intensity={0.5} 
        color={color}
        distance={6}
        castShadow={false}
      />
    </group>
  )
}

// Agent capsule 3D character
function Agent3D({
  runtime,
  position,
  onClick,
  onHover,
  onUnhover,
  isActive = false,
}: {
  runtime: AgentRuntime
  position: [number, number, number]
  onClick: () => void
  onHover: () => void
  onUnhover: () => void
  isActive?: boolean
}) {
  const meshRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  
  // Get agent color
  const agentColor = runtime.agent.color || "#42A5F5"
  const status = runtime.status
  const statusColor = status === "working" || status === "thinking" 
    ? STATUS_COLORS.active 
    : status === "idle" 
      ? STATUS_COLORS.idle 
      : STATUS_COLORS.sleeping

  // Animation
  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.getElapsedTime()
    
    if (isActive || status === "working" || status === "thinking") {
      // Walking animation - bob up and down
      meshRef.current.position.y = position[1] + Math.sin(time * 8) * 0.05
      // Slight rotation for walking feel
      meshRef.current.rotation.z = Math.sin(time * 8) * 0.05
    } else {
      // Idle bounce
      meshRef.current.position.y = position[1] + Math.sin(time * 2) * 0.02
      meshRef.current.rotation.z = 0
    }
    
    // Glow pulse
    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshStandardMaterial
      material.emissiveIntensity = 0.3 + Math.sin(time * 3) * 0.2
    }
  })

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
    onHover()
    document.body.style.cursor = "pointer"
  }

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(false)
    onUnhover()
    document.body.style.cursor = "auto"
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick()
  }

  return (
    <group 
      ref={meshRef} 
      position={position}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Status glow ring */}
      <mesh ref={glowRef} position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.35, 32]} />
        <meshStandardMaterial 
          color={statusColor}
          emissive={statusColor}
          emissiveIntensity={0.5}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Body - capsule shape */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.2, 0.4, 16, 16]} />
        <meshStandardMaterial 
          color={agentColor}
          roughness={0.3}
          metalness={0.1}
          emissive={hovered ? agentColor : "#000000"}
          emissiveIntensity={hovered ? 0.3 : 0}
        />
      </mesh>
      
      {/* Eye goggle band */}
      <mesh position={[0, 0.25, 0.18]}>
        <boxGeometry args={[0.35, 0.08, 0.05]} />
        <meshStandardMaterial color="#9E9E9E" metalness={0.5} roughness={0.3} />
      </mesh>
      
      {/* Eye */}
      <mesh position={[0, 0.25, 0.21]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="white" />
      </mesh>
      
      {/* Pupil */}
      <mesh position={[0, 0.25, 0.29]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#5D4037" />
      </mesh>
      
      {/* Hair strands */}
      {[0, 0.06, -0.06].map((offset, i) => (
        <mesh key={i} position={[offset, 0.5, 0]}>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 8]} />
          <meshStandardMaterial color={agentColor} />
        </mesh>
      ))}
      
      {/* Overalls */}
      <mesh position={[0, -0.15, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.2, 0.25, 16]} />
        <meshStandardMaterial color="#546E7A" roughness={0.7} />
      </mesh>
      
      {/* Feet */}
      <mesh position={[-0.08, -0.35, 0.05]} castShadow>
        <boxGeometry args={[0.08, 0.05, 0.12]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      <mesh position={[0.08, -0.35, 0.05]} castShadow>
        <boxGeometry args={[0.08, 0.05, 0.12]} />
        <meshStandardMaterial color="#212121" />
      </mesh>
      
      {/* Active sparkles */}
      {(status === "working" || status === "thinking") && (
        <Sparkles 
          count={20} 
          scale={0.8} 
          size={3} 
          speed={0.4} 
          color={statusColor}
        />
      )}
      
      {/* Name label on hover */}
      {hovered && (
        <Html position={[0, 0.8, 0]} center distanceFactor={10}>
          <div className="px-3 py-1.5 bg-black/80 text-white rounded-lg text-sm whitespace-nowrap shadow-lg border border-white/20">
            <div className="font-bold">{runtime.agent.name}</div>
            <div className="text-xs text-gray-300 capitalize">{runtime.status}</div>
          </div>
        </Html>
      )}
    </group>
  )
}

// Session minion 3D character (smaller, different style)
function Session3D({
  session,
  position,
  onClick,
  onHover,
  onUnhover,
  isActive = false,
  isSubagent = false,
}: {
  session: MinionSession
  position: [number, number, number]
  onClick: () => void
  onHover: () => void
  onUnhover: () => void
  isActive?: boolean
  isSubagent?: boolean
}) {
  const meshRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  
  // Get session color
  const minionType = getMinionType(session)
  const sessionColor = minionType.color.replace("#", "")
  const displayName = getSessionDisplayName(session)
  
  const scale = isSubagent ? 0.6 : 0.8

  // Animation
  useFrame((state) => {
    if (!meshRef.current) return
    const time = state.clock.getElapsedTime()
    
    if (isActive) {
      // Active walking
      meshRef.current.position.y = position[1] + Math.sin(time * 6) * 0.04
      meshRef.current.rotation.z = Math.sin(time * 6) * 0.03
    } else {
      // Gentle idle bob
      meshRef.current.position.y = position[1] + Math.sin(time * 1.5 + position[0]) * 0.015
      meshRef.current.rotation.z = 0
    }
  })

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
    onHover()
    document.body.style.cursor = "pointer"
  }

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(false)
    onUnhover()
    document.body.style.cursor = "auto"
  }

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    onClick()
  }

  return (
    <group 
      ref={meshRef} 
      position={position}
      scale={scale}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* Status indicator glow */}
      <mesh position={[0, -0.3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.22, 32]} />
        <meshStandardMaterial 
          color={isActive ? STATUS_COLORS.active : STATUS_COLORS.idle}
          emissive={isActive ? STATUS_COLORS.active : STATUS_COLORS.idle}
          emissiveIntensity={0.4}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Pill-shaped body */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <capsuleGeometry args={[0.15, 0.3, 12, 12]} />
        <meshStandardMaterial 
          color={`#${sessionColor}`}
          roughness={0.4}
          metalness={0.05}
          emissive={hovered ? `#${sessionColor}` : "#000000"}
          emissiveIntensity={hovered ? 0.2 : 0}
        />
      </mesh>
      
      {/* Eye */}
      <mesh position={[0, 0.15, 0.13]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, 0.15, 0.18]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color="#333" />
      </mesh>
      
      {/* Active sparkles */}
      {isActive && (
        <Sparkles 
          count={10} 
          scale={0.5} 
          size={2} 
          speed={0.3} 
          color={STATUS_COLORS.active}
        />
      )}
      
      {/* Name tooltip on hover */}
      {hovered && (
        <Html position={[0, 0.6, 0]} center distanceFactor={10}>
          <div className="px-2 py-1 bg-black/80 text-white rounded text-xs whitespace-nowrap shadow-lg border border-white/20 max-w-[180px]">
            <div className="font-semibold truncate">{displayName}</div>
            {session.label && (
              <div className="text-[10px] text-gray-300 truncate">{session.label}</div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

// Main floor with large grid
function Floor() {
  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial 
          color="#1a1a2e" 
          roughness={0.9}
          metalness={0}
        />
      </mesh>
      
      {/* Main grid */}
      <gridHelper 
        args={[50, 50, "#2a2a4e", "#1f1f3a"]} 
        position={[0, -0.49, 0]}
      />
      
      {/* Accent grid overlay */}
      <gridHelper 
        args={[50, 10, "#4f46e5", "#4f46e520"]} 
        position={[0, -0.48, 0]}
      />
    </group>
  )
}

// Scene component that uses all the data
function Scene({
  rooms,
  itemsByRoom,
  onSessionClick,
  tokenTrackingRef,
}: {
  rooms: Room[]
  itemsByRoom: Map<string, { agents: AgentRuntime[]; orphanSessions: MinionSession[] }>
  onSessionClick: (session: MinionSession) => void
  tokenTrackingRef: React.MutableRefObject<Map<string, { previousTokens: number; lastChangeTime: number }>>
}) {
  // setHoveredItem used for hover tracking (value not read yet but used for events)
  const [, setHoveredItem] = useState<string | null>(null)
  
  // Calculate room positions in a 2x2 grid
  const roomPositions = useMemo(() => {
    const positions: Map<string, [number, number, number]> = new Map()
    const sorted = [...rooms].sort((a, b) => a.sort_order - b.sort_order)
    
    sorted.forEach((room, index) => {
      const row = Math.floor(index / 2)
      const col = index % 2
      const x = (col - 0.5) * 8
      const z = (row - 0.5) * 8
      positions.set(room.id, [x, 0, z])
    })
    
    return positions
  }, [rooms])

  // Check if session is actively running
  const isActivelyRunning = useCallback((sessionKey: string): boolean => {
    const tracked = tokenTrackingRef.current.get(sessionKey)
    if (!tracked) return false
    return Date.now() - tracked.lastChangeTime < 30000
  }, [tokenTrackingRef])

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={1} 
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={50}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      />
      <pointLight position={[-10, 10, -10]} intensity={0.5} color="#4f46e5" />
      <pointLight position={[10, 10, 10]} intensity={0.3} color="#f97316" />
      
      {/* Floor */}
      <Floor />
      
      {/* Room platforms */}
      {rooms.map((room) => {
        const position = roomPositions.get(room.id) || [0, 0, 0]
        const items = itemsByRoom.get(room.id) || { agents: [], orphanSessions: [] }
        const itemCount = items.agents.length + items.orphanSessions.length
        
        return (
          <RoomPlatform
            key={room.id}
            room={room}
            position={position as [number, number, number]}
            size={[6, 0.3, 6]}
            itemCount={itemCount}
          />
        )
      })}
      
      {/* Agents and sessions in rooms */}
      {rooms.map((room) => {
        const roomPos = roomPositions.get(room.id) || [0, 0, 0]
        const items = itemsByRoom.get(room.id) || { agents: [], orphanSessions: [] }
        
        // Calculate positions for items within room
        const allItems = [...items.agents, ...items.orphanSessions]
        const itemPositions = allItems.map((_, index) => {
          const count = allItems.length
          if (count === 1) return [0, 0, 0]
          
          // Arrange in a circle or grid
          if (count <= 8) {
            const angle = (index / count) * Math.PI * 2
            const radius = 1.5
            return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
          } else {
            // Grid layout for many items
            const cols = Math.ceil(Math.sqrt(count))
            const row = Math.floor(index / cols)
            const col = index % cols
            const spacing = 1.2
            const offsetX = ((cols - 1) / 2) * spacing
            const offsetZ = ((Math.ceil(count / cols) - 1) / 2) * spacing
            return [(col * spacing) - offsetX, 0, (row * spacing) - offsetZ]
          }
        })
        
        return (
          <group key={room.id}>
            {/* Render agents */}
            {items.agents.map((runtime, index) => {
              const localPos = itemPositions[index] || [0, 0, 0]
              const worldPos: [number, number, number] = [
                roomPos[0] + localPos[0],
                roomPos[1] + 0.5,
                roomPos[2] + localPos[2]
              ]
              
              return (
                <Agent3D
                  key={runtime.agent.id}
                  runtime={runtime}
                  position={worldPos}
                  onClick={() => {
                    if (runtime.session) {
                      onSessionClick(runtime.session)
                    }
                  }}
                  onHover={() => setHoveredItem(runtime.agent.id)}
                  onUnhover={() => setHoveredItem(null)}
                  isActive={runtime.status === "working" || runtime.status === "thinking"}
                />
              )
            })}
            
            {/* Render orphan sessions */}
            {items.orphanSessions.map((session, index) => {
              const sessionIndex = items.agents.length + index
              const localPos = itemPositions[sessionIndex] || [0, 0, 0]
              const worldPos: [number, number, number] = [
                roomPos[0] + localPos[0],
                roomPos[1] + 0.4,
                roomPos[2] + localPos[2]
              ]
              const isSubagent = session.key.includes(":subagent:") || session.key.includes(":spawn:")
              
              return (
                <Session3D
                  key={session.key}
                  session={session}
                  position={worldPos}
                  onClick={() => onSessionClick(session)}
                  onHover={() => setHoveredItem(session.key)}
                  onUnhover={() => setHoveredItem(null)}
                  isActive={isActivelyRunning(session.key)}
                  isSubagent={isSubagent}
                />
              )
            })}
          </group>
        )
      })}
      
      {/* Orbit controls */}
      <OrbitControls 
        makeDefault
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={40}
        target={[0, 0, 0]}
      />
    </>
  )
}

// Loading placeholder
function LoadingPlaceholder() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#4f46e5" />
    </mesh>
  )
}

export function Playground3DView({ sessions, onAliasChanged: _onAliasChanged, settings: _settings }: Playground3DViewProps) {
  // _onAliasChanged and _settings reserved for future use
  void _onAliasChanged
  void _settings
  
  const [selectedSession, setSelectedSession] = useState<MinionSession | null>(null)
  const [logViewerOpen, setLogViewerOpen] = useState(false)
  
  const { agents: agentRuntimes } = useAgentsRegistry(true)
  const { rooms, getRoomForSession, isLoading: roomsLoading } = useRooms()
  const tokenTrackingRef = useRef<Map<string, { previousTokens: number; lastChangeTime: number }>>(new Map())
  
  // Track token changes for activity detection
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
  
  // Filter sessions
  const activeSessions = sessions.filter(s => !shouldBeInParkingLane(s, isActivelyRunning(s.key)))
  const sortedActiveSessions = [...activeSessions].sort((a, b) => b.updatedAt - a.updatedAt)
  const visibleSessions = sortedActiveSessions.slice(0, 15)
  
  // Group items by room
  const itemsByRoom = useMemo(() => {
    const grouped = new Map<string, { agents: AgentRuntime[]; orphanSessions: MinionSession[] }>()
    rooms.forEach(room => grouped.set(room.id, { agents: [], orphanSessions: [] }))
    
    // Place agents in their rooms
    agentRuntimes.forEach(runtime => {
      const roomId = runtime.agent.default_room_id || rooms[0]?.id || "default"
      const existing = grouped.get(roomId)
      if (existing) existing.agents.push(runtime)
      else grouped.set(roomId, { agents: [runtime], orphanSessions: [] })
    })
    
    // Find orphan sessions (not attached to agents)
    const agentSessionKeys = new Set(agentRuntimes.map(r => r.agent.agent_session_key).filter(Boolean))
    const orphanSessions = visibleSessions.filter(session => {
      const isAgentMain = agentSessionKeys.has(session.key)
      const isAgentChild = agentRuntimes.some(runtime => runtime.childSessions.some(child => child.key === session.key))
      return !isAgentMain && !isAgentChild
    })
    
    orphanSessions.forEach(session => {
      const assignedRoomId = getRoomForSession(session.key, { 
        label: session.label, 
        model: session.model,
        channel: session.lastChannel 
      })
      const targetRoomId = assignedRoomId || getDefaultRoomForSession(session.key) || rooms[0]?.id || "headquarters"
      const existing = grouped.get(targetRoomId)
      if (existing) existing.orphanSessions.push(session)
      else {
        const fallbackRoomId = rooms[0]?.id || "default"
        const fallback = grouped.get(fallbackRoomId)
        if (fallback) fallback.orphanSessions.push(session)
      }
    })
    
    return grouped
  }, [agentRuntimes, visibleSessions, rooms, getRoomForSession])

  const handleSessionClick = (session: MinionSession) => {
    setSelectedSession(session)
    setLogViewerOpen(true)
  }

  if (roomsLoading || rooms.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[600px] bg-[#1a1a2e]">
        <div className="text-white/50 text-sm">Loading 3D scene...</div>
      </div>
    )
  }

  return (
    <>
      <div className="relative w-full h-full" style={{ minHeight: "600px" }}>
        <Canvas
          shadows
          camera={{
            position: [12, 12, 12],
            fov: 50,
            near: 0.1,
            far: 100,
          }}
          style={{ background: "linear-gradient(180deg, #0f0f23 0%, #1a1a2e 100%)" }}
        >
          <Suspense fallback={<LoadingPlaceholder />}>
            <Scene
              rooms={rooms}
              itemsByRoom={itemsByRoom}
              onSessionClick={handleSessionClick}
              tokenTrackingRef={tokenTrackingRef}
            />
          </Suspense>
        </Canvas>
        
        {/* Overlay info */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          <div className="text-sm text-center px-4 py-2 rounded-full backdrop-blur-md text-white bg-black/50 shadow-lg border border-white/10">
            {agentRuntimes.length} agents · {visibleSessions.length} active · Click for details · Drag to rotate
          </div>
        </div>
        
        {/* Controls hint */}
        <div className="absolute top-4 right-4 z-50">
          <div className="text-xs px-3 py-1.5 rounded-lg backdrop-blur-md text-white/70 bg-black/30 border border-white/10">
            🖱️ Drag: Rotate · Scroll: Zoom · Right-drag: Pan
          </div>
        </div>
        
        {/* Empty state */}
        {agentRuntimes.length === 0 && visibleSessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-center">
              <div className="text-6xl mb-4">💤</div>
              <p className="text-xl font-semibold text-white">No agents or sessions</p>
              <p className="text-white/50 text-sm mt-2">Agents will appear when they're active!</p>
            </div>
          </div>
        )}
      </div>
      
      <LogViewer session={selectedSession} open={logViewerOpen} onOpenChange={setLogViewerOpen} />
    </>
  )
}

import { useState, memo } from "react"
import { Settings, RotateCcw, Pin, PinOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { CrewAvatar } from "./CrewAvatar"
import { CrewWindow } from "./CrewWindow"
import { useCrewWindows } from "./CrewWindowManager"
import type { CrewAgent, CrewBarConfig } from "./types"

interface CrewBarProps {
  /**
   * List of agents to display in the bar
   */
  agents: CrewAgent[]
  
  /**
   * Configuration for chat functionality
   */
  config: CrewBarConfig
  
  /**
   * Callback when an agent's pinned state changes
   */
  onTogglePin?: (agentId: string) => void
  
  /**
   * Custom class name for the bar container
   */
  className?: string
}

// Memoized agent button to prevent unnecessary re-renders
const CrewBarItem = memo(({ 
  agent, 
  onClick, 
  onTogglePin 
}: { 
  agent: CrewAgent
  onClick: (agent: CrewAgent) => void
  onTogglePin?: (agentId: string) => void
}) => {
  return (
    <div className="relative flex flex-col items-center gap-1.5 pb-1 group">
      <CrewAvatar 
        agent={agent} 
        size="md"
        onClick={() => onClick(agent)}
      />
      <span className="text-[10px] text-muted-foreground font-medium leading-none">
        {agent.name}
      </span>
      
      {/* Pin/Unpin button - shows on hover */}
      {onTogglePin && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onTogglePin(agent.id)
          }}
          className={cn(
            "absolute -top-1 -right-1 w-5 h-5 rounded-full",
            "flex items-center justify-center",
            "bg-background border border-border",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "hover:bg-muted"
          )}
          title={agent.isPinned ? "Unpin" : "Pin"}
        >
          {agent.isPinned ? (
            <PinOff className="w-3 h-3 text-muted-foreground" />
          ) : (
            <Pin className="w-3 h-3 text-muted-foreground" />
          )}
        </button>
      )}
    </div>
  )
})

CrewBarItem.displayName = "CrewBarItem"

/**
 * CrewBar - A floating bar with agent avatars that open chat windows
 * 
 * @example
 * ```tsx
 * <CrewBar
 *   agents={[
 *     { id: "1", name: "Claude", emoji: "🤖", color: "#6366f1", status: "idle", isPinned: true },
 *     { id: "2", name: "GPT", emoji: "🧠", color: "#22c55e", status: "working", isPinned: true },
 *   ]}
 *   config={{
 *     sendMessage: async (agentId, message) => {
 *       const response = await fetch(`/api/agents/${agentId}/chat`, {
 *         method: "POST",
 *         body: JSON.stringify({ message }),
 *       })
 *       const data = await response.json()
 *       return data.response
 *     },
 *   }}
 *   onTogglePin={(agentId) => togglePin(agentId)}
 * />
 * ```
 */
export function CrewBar({ 
  agents, 
  config,
  onTogglePin,
  className 
}: CrewBarProps) {
  const [showOptions, setShowOptions] = useState(false)
  
  const {
    openWindows,
    openWindow,
    closeWindow,
    focusWindow,
    getZIndex,
    updateWindowState,
    resetWindowStates,
  } = useCrewWindows()

  const handleAgentClick = (agent: CrewAgent) => {
    openWindow(agent)
  }

  const handleResetWindows = () => {
    resetWindowStates()
    setShowOptions(false)
  }

  // Show only pinned agents in the bar (or all if no pinning system)
  const visibleAgents = agents.filter((agent) => agent.isPinned !== false)

  return (
    <>
      {/* Floating windows */}
      {openWindows.map((window) => (
        <CrewWindow
          key={window.id}
          agent={window.agent}
          config={config}
          onClose={() => closeWindow(window.id)}
          initialPosition={window.position}
          initialSize={window.size}
          onFocus={() => focusWindow(window.id)}
          onStateChange={(pos, size) => updateWindowState(window.agent.id, pos, size)}
          zIndex={getZIndex(window.id)}
        />
      ))}
      
      {/* Bottom bar */}
      <div 
        className={cn(
          "hidden md:flex fixed bottom-0 left-1/2 -translate-x-1/2",
          "items-end gap-4 px-6 py-3 pb-2",
          "bg-background/80 backdrop-blur-lg",
          "border border-border border-b-0 rounded-t-2xl shadow-lg",
          "z-[60]",
          className
        )}
      >
        {visibleAgents.map((agent) => (
          <CrewBarItem 
            key={agent.id} 
            agent={agent} 
            onClick={handleAgentClick}
            onTogglePin={onTogglePin}
          />
        ))}

        {/* Divider (only show if there are agents) */}
        {visibleAgents.length > 0 && (
          <div className="w-px h-10 bg-border mx-1" />
        )}

        {/* Options button */}
        <div className="relative flex flex-col items-center gap-1.5 pb-1">
          <button
            onClick={() => setShowOptions(!showOptions)}
            className={cn(
              "w-10 h-10 rounded-full",
              "flex items-center justify-center",
              "bg-muted/50 hover:bg-muted",
              "border border-border",
              "transition-colors",
              showOptions && "bg-muted"
            )}
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-[10px] text-muted-foreground font-medium leading-none">
            Options
          </span>

          {/* Dropdown menu */}
          {showOptions && (
            <>
              {/* Backdrop to close */}
              <div 
                className="fixed inset-0 z-[59]" 
                onClick={() => setShowOptions(false)} 
              />
              
              {/* Menu */}
              <div className={cn(
                "absolute bottom-full mb-2 right-0",
                "bg-popover border border-border rounded-lg shadow-lg",
                "py-1 min-w-[180px]",
                "z-[70]"
              )}>
                {/* Agent list with pin toggle */}
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => {
                      onTogglePin?.(agent.id)
                    }}
                    className={cn(
                      "w-full px-3 py-2 text-sm text-left",
                      "flex items-center justify-between gap-2",
                      "hover:bg-muted transition-colors"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span>{agent.emoji}</span>
                      <span>{agent.name}</span>
                    </span>
                    {agent.isPinned && (
                      <Pin className="w-3 h-3 text-primary" />
                    )}
                  </button>
                ))}
                
                {agents.length > 0 && <div className="border-t my-1" />}
                
                <button
                  onClick={handleResetWindows}
                  className={cn(
                    "w-full px-3 py-2 text-sm text-left",
                    "flex items-center gap-2",
                    "hover:bg-muted transition-colors"
                  )}
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset windows
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}

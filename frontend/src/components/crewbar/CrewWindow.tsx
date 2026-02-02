import { useState, useRef, useEffect, useCallback } from "react"
import { Rnd } from "react-rnd"
import { X, Send, Minus, Maximize2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { CrewAvatar } from "./CrewAvatar"
import type { CrewAgent, CrewMessage, CrewBarConfig } from "./types"

interface CrewWindowProps {
  agent: CrewAgent
  config: CrewBarConfig
  onClose: () => void
  initialPosition?: { x: number; y: number }
  initialSize?: { width: number; height: number }
  onFocus: () => void
  onStateChange?: (position: { x: number; y: number }, size: { width: number; height: number }) => void
  zIndex: number
}

const DEFAULT_SIZE = { width: 380, height: 500 }
const MIN_SIZE = { width: 300, height: 300 }

export function CrewWindow({ 
  agent, 
  config,
  onClose, 
  initialPosition,
  initialSize,
  onFocus,
  onStateChange,
  zIndex 
}: CrewWindowProps) {
  const [messages, setMessages] = useState<CrewMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [size, setSize] = useState(initialSize || DEFAULT_SIZE)
  const [position, setPosition] = useState(initialPosition || { x: 100, y: 100 })
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // Add welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeContent = config.welcomeMessage?.(agent) 
        || `${agent.emoji} Hi! I'm ${agent.name}. How can I help you?`
      
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: welcomeContent,
        timestamp: new Date().toISOString()
      }])
    }
  }, [messages.length, agent, config])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: CrewMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    const messageToSend = input.trim()
    setInput("")
    setIsLoading(true)

    try {
      const response = await config.sendMessage(agent.id, messageToSend)
      
      const assistantMessage: CrewMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response,
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error("Chat error:", error)
      const errorContent = config.errorMessage || "⚠️ Connection failed. Please try again."
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: errorContent,
        timestamp: new Date().toISOString()
      }])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, agent.id, config])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDragStop = (_: unknown, d: { x: number; y: number }) => {
    const newPosition = { x: d.x, y: d.y }
    setPosition(newPosition)
    onStateChange?.(newPosition, size)
  }

  const handleResizeStop = (_: unknown, __: unknown, ref: HTMLElement, ___: unknown, pos: { x: number; y: number }) => {
    const newSize = { width: parseInt(ref.style.width), height: parseInt(ref.style.height) }
    setSize(newSize)
    setPosition(pos)
    onStateChange?.(pos, newSize)
  }

  const placeholder = config.inputPlaceholder?.(agent.name) || `Ask ${agent.name}...`

  return (
    <Rnd
      size={isMinimized ? { width: size.width, height: 48 } : size}
      position={position}
      minWidth={MIN_SIZE.width}
      minHeight={isMinimized ? 48 : MIN_SIZE.height}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onDragStart={onFocus}
      onMouseDown={onFocus}
      bounds="window"
      dragHandleClassName="window-drag-handle"
      enableResizing={!isMinimized}
      style={{ zIndex }}
      className={cn(
        "rounded-2xl overflow-hidden shadow-2xl",
        "border border-border",
        "bg-background"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Title bar - draggable */}
        <div 
          className={cn(
            "window-drag-handle flex items-center gap-3",
            "px-4 py-3",
            "cursor-move select-none",
            "border-b"
          )}
          style={{ backgroundColor: agent.color + "15" }}
        >
          <div style={{ marginTop: 8 }}>
            <CrewAvatar agent={agent} size="sm" showStatus={false} />
          </div>
          <div className="flex-1 min-w-0" style={{ marginTop: 8 }}>
            <div className="font-semibold text-sm truncate leading-tight">{agent.name}</div>
            {agent.model && (
              <div className="text-[10px] text-muted-foreground truncate leading-tight">
                {agent.model}
              </div>
            )}
          </div>
          
          {/* Window controls - use onPointerDown to handle both mouse and touch */}
          <div className="flex items-center gap-1">
            <button
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); setIsMinimized(!isMinimized); }}
              className="p-2.5 hover:bg-muted rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
            >
              {isMinimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
            </button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
              className="p-2.5 hover:bg-destructive hover:text-destructive-foreground rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content - only show when not minimized */}
        {!isMinimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2",
                    msg.role === "user" && "flex-row-reverse"
                  )}
                >
                  {msg.role === "assistant" && (
                    <span className="text-lg flex-shrink-0">{agent.emoji}</span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] px-3 py-2 rounded-2xl text-sm",
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    )}
                  >
                    <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-2">
                  <span className="text-lg">{agent.emoji}</span>
                  <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-md">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-2 border-t">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-full",
                    "bg-muted border border-border",
                    "focus:outline-none focus:ring-2 focus:ring-primary",
                    "text-sm"
                  )}
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-9 h-9 rounded-full flex-shrink-0",
                    "flex items-center justify-center",
                    "bg-primary text-primary-foreground",
                    "hover:bg-primary/90 disabled:opacity-50",
                    "transition-colors"
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Rnd>
  )
}

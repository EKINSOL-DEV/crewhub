import { useRef, useEffect, useState, useCallback, type KeyboardEvent } from 'react'
import { Rnd } from 'react-rnd'
import { ArrowUp, X } from 'lucide-react'
import { useChatContext, MIN_SIZE } from '@/contexts/ChatContext'
import { useStreamingChat } from '@/hooks/useStreamingChat'
import { ChatMessageBubble } from './ChatMessageBubble'
import { useVoiceRecorder, formatDuration } from '@/hooks/useVoiceRecorder'

const BACKGROUND_0_15S_COLOR_0_15S = 'background 0.15s, color 0.15s'
const SYSTEM_UI_SANS_SERIF = 'system-ui, sans-serif'

// (renderMarkdown, ThinkingBlock, ToolCallBlock, ChatBubble all moved to ChatMessageBubble.tsx)

// ── Agent Chat Window ──────────────────────────────────────────

interface AgentChatWindowProps {
  readonly sessionKey: string
  readonly agentName: string
  readonly agentIcon: string | null
  readonly agentColor: string | null
  readonly position: { x: number; y: number }
  readonly size: { width: number; height: number }
  readonly zIndex: number
}

export function AgentChatWindow({
  sessionKey,
  agentName,
  agentIcon,
  agentColor,
  position,
  size,
  zIndex,
}: AgentChatWindowProps) {
  const {
    closeChat,
    minimizeChat,
    toggleInternals,
    focusChat,
    updatePosition,
    updateSize,
    onFocusAgent,
    windows,
  } = useChatContext()

  const windowState = windows.find((w) => w.sessionKey === sessionKey)
  const showInternals = windowState?.showInternals ?? false
  const accentColor = agentColor || '#8b5cf6'
  const icon = agentIcon || '🤖'

  const {
    messages,
    isSending,
    streamingMessageId,
    error,
    sendMessage,
    loadOlderMessages,
    hasMore,
    isLoadingHistory,
  } = useStreamingChat(sessionKey, showInternals)

  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)
  const prevStreamingIdRef = useRef<string | null>(null)

  // Check if near bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const threshold = 100
    isNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  }, [])

  // Auto-scroll to bottom when new messages arrive (only if already near bottom)
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      if (prevMessageCount.current === 0) {
        // First load — instant scroll, no visual jump
        const container = scrollContainerRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      } else if (isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    prevMessageCount.current = messages.length
  }, [messages.length])

  // Auto-scroll during streaming (fires on every content delta)
  useEffect(() => {
    const wasStreaming = prevStreamingIdRef.current !== null
    const isStreaming = streamingMessageId !== null

    if (isStreaming && isNearBottomRef.current) {
      // During streaming: follow new tokens if user hasn't scrolled up
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    } else if (wasStreaming && !isStreaming) {
      // Streaming just ended: final scroll to bottom and reset scroll-up guard
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      isNearBottomRef.current = true
    }

    prevStreamingIdRef.current = streamingMessageId
  }, [messages, streamingMessageId])

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150)
  }, [])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text || isSending) return
    setInputValue('')
    sendMessage(text)
  }, [inputValue, isSending, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Voice recording ────────────────────────────────────────────
  const handleAudioReady = useCallback(
    (url: string, duration: number, transcript: string | null, transcriptError: string | null) => {
      let msg = `[audio attached: ${url} (audio/webm) ${duration}s]`
      if (transcript) {
        msg += `\nTranscript: "${transcript}"`
      } else if (transcriptError) {
        msg += `\n[Voice transcription unavailable: ${transcriptError}]`
      }
      sendMessage(msg)
    },
    [sendMessage]
  )

  const {
    isRecording,
    isPreparing: micPreparing,
    duration: recDuration,
    error: recError,
    isSupported: micSupported,
    startRecording,
    stopAndSend,
    cancelRecording,
  } = useVoiceRecorder(handleAudioReady)

  // ESC cancels recording
  useEffect(() => {
    if (!isRecording) return
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') cancelRecording()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRecording, cancelRecording])

  const handleDragStop = (_e: unknown, d: { x: number; y: number }) => {
    setIsDragging(false)
    updatePosition(sessionKey, { x: d.x, y: d.y })
  }

  const handleResizeStop = (
    _: unknown,
    __: unknown,
    ref: HTMLElement,
    ___: unknown,
    pos: { x: number; y: number }
  ) => {
    setIsResizing(false)
    updateSize(sessionKey, {
      width: Number.parseInt(ref.style.width),
      height: Number.parseInt(ref.style.height),
    })
    updatePosition(sessionKey, pos)
  }

  return (
    <>
      {/* Fullscreen overlay during drag/resize — blocks WebGL canvas from stealing pointer events */}
      {(isDragging || isResizing) && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: zIndex - 1,
            pointerEvents: 'all',
            cursor: isDragging ? 'grabbing' : 'nwse-resize',
          }}
        />
      )}
      <Rnd
        size={size}
        position={position}
        minWidth={MIN_SIZE.width}
        minHeight={MIN_SIZE.height}
        onDragStart={() => {
          setIsDragging(true)
          focusChat(sessionKey)
        }}
        onDragStop={handleDragStop}
        onResizeStart={() => setIsResizing(true)}
        onResizeStop={handleResizeStop}
        onMouseDown={() => focusChat(sessionKey)}
        bounds="window"
        dragHandleClassName="chat-window-drag-handle"
        enableUserSelectHack={true}
        style={{ zIndex }}
        className="chat-window-container"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 16,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            overflow: 'hidden',
          }}
        >
          {/* ── Header / Drag Handle ── */}
          <div
            className="chat-window-drag-handle"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              cursor: 'grab',
              userSelect: 'none',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              background: accentColor + '12',
            }}
          >
            {/* Agent avatar */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                background: accentColor + '30',
                flexShrink: 0,
              }}
            >
              {icon}
            </div>

            {/* Agent name */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: '#1f2937',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {agentName}
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>
                {isSending ? 'Thinking…' : 'Online'}
              </div>
            </div>

            {/* Header buttons */}
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {onFocusAgent && (
                <HeaderBtn onClick={() => onFocusAgent(sessionKey)} tooltip="Focus agent">
                  🎯
                </HeaderBtn>
              )}
              <HeaderBtn
                onClick={() => toggleInternals(sessionKey)}
                tooltip={showInternals ? 'Hide thinking & tools' : 'Show thinking & tools'}
                active={showInternals}
                activeColor="#9333ea"
              >
                🧠
              </HeaderBtn>
              <HeaderBtn onClick={() => minimizeChat(sessionKey)} tooltip="Minimize">
                ─
              </HeaderBtn>
              <HeaderBtn onClick={() => closeChat(sessionKey)} tooltip="Close">
                ✕
              </HeaderBtn>
            </div>
          </div>

          {/* Accent line */}
          <div
            style={{
              height: 2,
              background: `linear-gradient(90deg, ${accentColor}00, ${accentColor}, ${accentColor}00)`,
            }}
          />

          {/* ── Messages ── */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {hasMore && (
              <button
                onClick={loadOlderMessages}
                disabled={isLoadingHistory}
                style={{
                  alignSelf: 'center',
                  padding: '4px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(0,0,0,0.05)',
                  color: '#6b7280',
                  cursor: isLoadingHistory ? 'wait' : 'pointer',
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: SYSTEM_UI_SANS_SERIF,
                }}
              >
                {isLoadingHistory ? 'Loading…' : '↑ Load older messages'}
              </button>
            )}

            {!isLoadingHistory && messages.length === 0 && (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#9ca3af',
                  fontSize: 13,
                  padding: '40px 0',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 32 }}>{icon}</span>
                <span>Say hello to {agentName}!</span>
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                msg={msg}
                variant="float"
                accentColor={accentColor}
                showThinking={showInternals}
                showToolDetails={showInternals}
              />
            ))}

            {isSending && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 0',
                  color: '#9ca3af',
                  fontSize: 12,
                }}
              >
                <span className="chat-thinking-pulse">●</span>
                {agentName} is thinking…
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontSize: 12,
                  alignSelf: 'center',
                }}
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input ── */}
          <div
            style={{
              padding: '10px 16px 14px',
              borderTop: '1px solid rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {/* Recording indicator with send/cancel buttons (WhatsApp-style) */}
            {isRecording && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: '#ef4444',
                  fontFamily: 'monospace',
                  paddingBottom: 2,
                }}
              >
                <span style={{ animation: 'chat-rec-blink 0.6s step-end infinite' }}>●</span>
                {formatDuration(recDuration)}
                <span style={{ flex: 1 }} />
              </div>
            )}
            {recError && (
              <div style={{ fontSize: 11, color: '#ef4444', paddingBottom: 2 }}>{recError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Recording…' : `Message ${agentName}…`}
                disabled={isSending || isRecording}
                rows={1}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.1)',
                  background: 'rgba(255,255,255,0.8)',
                  color: '#1f2937',
                  fontSize: 13,
                  fontFamily: SYSTEM_UI_SANS_SERIF,
                  resize: 'none',
                  outline: 'none',
                  maxHeight: 80,
                  lineHeight: 1.4,
                }}
                onInput={(e) => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 80) + 'px'
                }}
              />
              {/* While recording: green send ↑ + ✕ cancel */}
              {isRecording && (
                <>
                  <button
                    onClick={stopAndSend}
                    title="Stop & send voice message"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: 'none',
                      background: '#22c55e',
                      color: '#fff',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <ArrowUp size={18} />
                  </button>
                  <button
                    onClick={cancelRecording}
                    title="Cancel recording"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(0,0,0,0.06)',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <X size={16} />
                  </button>
                </>
              )}
              {/* While not recording: mic + send */}
              {!isRecording && (
                <>
                  {micSupported && (
                    <button
                      onClick={startRecording}
                      disabled={micPreparing || isSending}
                      title="Record voice message"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        border: 'none',
                        background: 'rgba(0,0,0,0.06)',
                        color: '#6b7280',
                        cursor: micPreparing || isSending ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        flexShrink: 0,
                        transition: BACKGROUND_0_15S_COLOR_0_15S,
                      }}
                    >
                      {micPreparing ? '⏳' : '🎤'}
                    </button>
                  )}
                  <button
                    onClick={handleSend}
                    disabled={isSending || !inputValue.trim()}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      border: 'none',
                      background:
                        isSending || !inputValue.trim() ? 'rgba(0,0,0,0.08)' : accentColor + 'dd',
                      color: isSending || !inputValue.trim() ? '#9ca3af' : '#fff',
                      cursor: isSending || !inputValue.trim() ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0,
                      transition: BACKGROUND_0_15S_COLOR_0_15S,
                    }}
                  >
                    ➤
                  </button>
                </>
              )}
            </div>
          </div>

          <style>{`
          @keyframes chat-rec-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>

          {/* Tooltip fade-in animation */}
          <style>{`
          @keyframes chatTooltipFadeIn {
            from {
              opacity: 0;
              transform: translateY(-50%) translateX(4px);
            }
            to {
              opacity: 1;
              transform: translateY(-50%) translateX(0);
            }
          }
        `}</style>
        </div>
      </Rnd>
    </>
  )
}

// ── Header Button ──────────────────────────────────────────────

function HeaderBtn({
  onClick,
  tooltip,
  active,
  activeColor,
  children,
}: {
  readonly onClick: () => void
  readonly tooltip: string
  readonly active?: boolean
  readonly activeColor?: string
  readonly children: React.ReactNode
}) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        onTouchEnd={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClick()
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          width: 26,
          height: 26,
          borderRadius: 7,
          border: 'none',
          background: (() => {
            if (active) return activeColor ? activeColor + '20' : 'rgba(0,0,0,0.08)'
            return isHovered ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0,0,0,0.04)'
          })(),
          color: active ? activeColor || '#374151' : '#6b7280',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
          transition: BACKGROUND_0_15S_COLOR_0_15S,
        }}
      >
        {children}
      </button>

      {/* Tooltip (appears on hover, to the left of the button) */}
      {isHovered && (
        <div
          style={{
            position: 'absolute',
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            marginRight: 8,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 100,
            fontFamily: SYSTEM_UI_SANS_SERIF,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            animation: 'chatTooltipFadeIn 0.15s ease-out',
          }}
        >
          {tooltip}
          {/* Tooltip arrow (pointing right) */}
          <div
            style={{
              position: 'absolute',
              right: -4,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderLeft: '4px solid rgba(0, 0, 0, 0.85)',
            }}
          />
        </div>
      )}
    </div>
  )
}

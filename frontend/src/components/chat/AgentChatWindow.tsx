import { useRef, useEffect, useState, useCallback, type KeyboardEvent, type CSSProperties } from 'react'
import { Rnd } from 'react-rnd'
import { useChatContext, MIN_SIZE } from '@/contexts/ChatContext'
import { useAgentChat, type ChatMessageData } from '@/hooks/useAgentChat'

// ── Lightweight markdown ────────────────────────────────────────

function renderMarkdown(text: string): string {
  let html = text.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, _lang, code) =>
      `<pre style="background:rgba(0,0,0,0.06);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:4px 0"><code>${escapeHtml(code.trim())}</code></pre>`
  )
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>'
  )
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/\n/g, '<br/>')
  return html
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Message Bubble ─────────────────────────────────────────────

function ChatBubble({
  msg,
  accentColor,
}: {
  msg: ChatMessageData
  accentColor: string
}) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af', fontStyle: 'italic', padding: '4px 0' }}>
        {msg.content}
      </div>
    )
  }

  const bubbleStyle: CSSProperties = isUser
    ? {
        background: accentColor + 'dd',
        color: '#fff',
        borderRadius: '14px 14px 4px 14px',
        marginLeft: 48,
        alignSelf: 'flex-end',
      }
    : {
        background: 'rgba(0,0,0,0.05)',
        color: '#1f2937',
        borderRadius: '14px 14px 14px 4px',
        marginRight: 48,
        alignSelf: 'flex-start',
      }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        ...({ alignItems: isUser ? 'flex-end' : 'flex-start' } as CSSProperties),
        gap: 2,
      }}
    >
      {msg.tools &&
        msg.tools.length > 0 &&
        msg.tools.map((tool, i) => (
          <div
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 500,
              background: 'rgba(0,0,0,0.04)',
              color: '#6b7280',
              alignSelf: 'flex-start',
            }}
          >
            🔧 {tool.name}{' '}
            {tool.status === 'done' || tool.status === 'called' ? '✓' : '✗'}
          </div>
        ))}

      {msg.content && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 13,
            lineHeight: 1.5,
            wordBreak: 'break-word',
            maxWidth: '100%',
            ...bubbleStyle,
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
      )}

      <div style={{ fontSize: 10, color: '#9ca3af', padding: '0 4px' }}>
        {formatTimestamp(msg.timestamp)}
      </div>
    </div>
  )
}

// ── Agent Chat Window ──────────────────────────────────────────

interface AgentChatWindowProps {
  sessionKey: string
  agentName: string
  agentIcon: string | null
  agentColor: string | null
  position: { x: number; y: number }
  size: { width: number; height: number }
  zIndex: number
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
    togglePin,
    focusChat,
    updatePosition,
    updateSize,
    onFocusAgent,
    windows,
  } = useChatContext()

  const isPinned = windows.find(w => w.sessionKey === sessionKey)?.isPinned ?? false
  const accentColor = agentColor || '#8b5cf6'
  const icon = agentIcon || '🤖'

  const {
    messages,
    isSending,
    error,
    sendMessage,
    loadOlderMessages,
    hasMore,
    isLoadingHistory,
  } = useAgentChat(sessionKey)

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)

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

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 150)
  }, [])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isSending) return
    setInputValue('')
    await sendMessage(text)
  }, [inputValue, isSending, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDragStop = (_: unknown, d: { x: number; y: number }) => {
    updatePosition(sessionKey, { x: d.x, y: d.y })
  }

  const handleResizeStop = (
    _: unknown,
    __: unknown,
    ref: HTMLElement,
    ___: unknown,
    pos: { x: number; y: number }
  ) => {
    updateSize(sessionKey, {
      width: parseInt(ref.style.width),
      height: parseInt(ref.style.height),
    })
    updatePosition(sessionKey, pos)
  }

  return (
    <Rnd
      size={size}
      position={position}
      minWidth={MIN_SIZE.width}
      minHeight={MIN_SIZE.height}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      onDragStart={() => focusChat(sessionKey)}
      onMouseDown={() => focusChat(sessionKey)}
      bounds="window"
      dragHandleClassName="chat-window-drag-handle"
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
              <HeaderBtn
                onClick={() => onFocusAgent(sessionKey)}
                title="Focus agent"
              >
                🎯
              </HeaderBtn>
            )}
            <HeaderBtn
              onClick={() => togglePin(sessionKey)}
              title={isPinned ? 'Unpin' : 'Pin (persist on reload)'}
              active={isPinned}
              activeColor={accentColor}
            >
              📌
            </HeaderBtn>
            <HeaderBtn onClick={() => minimizeChat(sessionKey)} title="Minimize">
              ─
            </HeaderBtn>
            <HeaderBtn onClick={() => closeChat(sessionKey)} title="Close">
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
                fontFamily: 'system-ui, sans-serif',
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

          {messages.map(msg => (
            <ChatBubble key={msg.id} msg={msg} accentColor={accentColor} />
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
            gap: 8,
            alignItems: 'flex-end',
          }}
        >
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agentName}…`}
            disabled={isSending}
            rows={1}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.1)',
              background: 'rgba(255,255,255,0.8)',
              color: '#1f2937',
              fontSize: 13,
              fontFamily: 'system-ui, sans-serif',
              resize: 'none',
              outline: 'none',
              maxHeight: 80,
              lineHeight: 1.4,
            }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 80) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={isSending || !inputValue.trim()}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: 'none',
              background:
                isSending || !inputValue.trim()
                  ? 'rgba(0,0,0,0.08)'
                  : accentColor + 'dd',
              color: isSending || !inputValue.trim() ? '#9ca3af' : '#fff',
              cursor: isSending || !inputValue.trim() ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            ➤
          </button>
        </div>
      </div>
    </Rnd>
  )
}

// ── Header Button ──────────────────────────────────────────────

function HeaderBtn({
  onClick,
  title,
  active,
  activeColor,
  children,
}: {
  onClick: () => void
  title: string
  active?: boolean
  activeColor?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={e => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        border: 'none',
        background: active
          ? (activeColor ? activeColor + '20' : 'rgba(0,0,0,0.08)')
          : 'rgba(0,0,0,0.04)',
        color: active ? (activeColor || '#374151') : '#6b7280',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = active
          ? (activeColor ? activeColor + '20' : 'rgba(0,0,0,0.08)')
          : 'rgba(0,0,0,0.04)'
      }}
    >
      {children}
    </button>
  )
}

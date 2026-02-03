import { useRef, useEffect, useState, useCallback, type KeyboardEvent, type CSSProperties } from 'react'
import { useChatContext, MIN_WIDTH, MIN_HEIGHT, MAX_WIDTH, MAX_HEIGHT } from '@/contexts/ChatContext'
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

// ── Tab Content (per-tab chat) ─────────────────────────────────

function TabContent({
  sessionKey,
  agentName,
  accentColor,
}: {
  sessionKey: string
  agentName: string
  accentColor: string
}) {
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
  const prevMessageCount = useRef(0)

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCount.current = messages.length
  }, [messages.length])

  useEffect(() => {
    if (messages.length > 0 && prevMessageCount.current === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
    }
  }, [messages.length])

  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isSending) return
    setInputValue('')
    await sendMessage(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
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
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: 13,
              fontStyle: 'italic',
              padding: '40px 0',
            }}
          >
            No messages yet. Say hello to {agentName}!
          </div>
        )}

        {messages.map((msg) => (
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
            <span style={{ animation: 'floatingChatPulse 1s ease-in-out infinite' }}>●</span>
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

      {/* Input area */}
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
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
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
          onInput={(e) => {
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
            color:
              isSending || !inputValue.trim() ? '#9ca3af' : '#fff',
            cursor:
              isSending || !inputValue.trim() ? 'default' : 'pointer',
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
    </>
  )
}

// ── Floating Chat Panel ────────────────────────────────────────

export function FloatingChatPanel() {
  const {
    chat,
    openChat,
    closeTab,
    closeChat,
    switchTab,
    togglePin,
    toggleMinimize,
    updatePosition,
    updateSize,
    onFocusAgent,
  } = useChatContext()

  const panelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const { size, position, tabs, activeTabKey } = chat
  const activeTab = tabs.find(t => t.sessionKey === activeTabKey) ?? tabs[0] ?? null
  const accentColor = activeTab?.agentColor || '#8b5cf6'

  // Default position: bottom-right corner
  const defaultX = typeof window !== 'undefined' ? window.innerWidth - size.width - 24 : 0
  const defaultY = typeof window !== 'undefined' ? window.innerHeight - size.height - 24 : 0
  const panelX = position?.x ?? defaultX
  const panelY = position?.y ?? defaultY

  // ── Drag handling ──────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      // Don't drag when clicking buttons, tabs, or interactive elements
      if ((e.target as HTMLElement).closest('button')) return
      if ((e.target as HTMLElement).closest('[data-tab]')) return

      e.preventDefault()
      isDragging.current = true

      const startX = e.clientX - panelX
      const startY = e.clientY - panelY

      const handleMouseMove = (ev: MouseEvent) => {
        const x = Math.max(0, Math.min(window.innerWidth - size.width, ev.clientX - startX))
        const y = Math.max(0, Math.min(window.innerHeight - size.height, ev.clientY - startY))
        updatePosition({ x, y })
      }
      const handleMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [panelX, panelY, size.width, size.height, updatePosition]
  )

  // ── Resize handling ────────────────────────────────────────

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startW = size.width
      const startH = size.height

      const handleMouseMove = (ev: MouseEvent) => {
        const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + (ev.clientX - startX)))
        const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH + (ev.clientY - startY)))
        updateSize({ width: w, height: h })
      }
      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [size.width, size.height, updateSize]
  )

  // ── Minimized bar ──────────────────────────────────────────

  if (chat.isMinimized && chat.tabs.length > 0) {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 1001,
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 12,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            cursor: 'pointer',
            userSelect: 'none',
            animation: 'floatingChatSlideUp 0.2s ease-out',
          }}
          onClick={toggleMinimize}
          title="Expand chat"
        >
          {tabs.map(tab => (
            <span key={tab.sessionKey} style={{ fontSize: 18 }} title={tab.agentName}>
              {tab.agentIcon || '🤖'}
            </span>
          ))}
          <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, marginLeft: 4 }}>
            ▲ Expand
          </span>
        </div>
        <style>{floatingStyles}</style>
      </>
    )
  }

  // ── FAB: when closed but pinned with tabs ──────────────────

  if (!chat.isOpen && chat.isPinned && chat.tabs.length > 0) {
    const firstTab = chat.tabs[0]
    const fabColor = firstTab.agentColor || '#8b5cf6'
    const fabIcon = firstTab.agentIcon || '🤖'
    return (
      <>
        <button
          onClick={() =>
            openChat(
              firstTab.sessionKey,
              firstTab.agentName,
              firstTab.agentIcon || undefined,
              firstTab.agentColor || undefined
            )
          }
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            background: fabColor,
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            zIndex: 1000,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.25)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)'
          }}
          title={`Reopen chat with ${firstTab.agentName}`}
        >
          {fabIcon}
          {tabs.length > 1 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                width: 18,
                height: 18,
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {tabs.length}
            </span>
          )}
        </button>
        <style>{floatingStyles}</style>
      </>
    )
  }

  // Not open, no FAB → nothing
  if (!chat.isOpen || chat.tabs.length === 0) return null

  // ── Full panel ─────────────────────────────────────────────

  return (
    <>
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          left: panelX,
          top: panelY,
          width: size.width,
          height: size.height,
          zIndex: 1001,
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 16,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'floatingChatSlideUp 0.3s ease-out',
        }}
      >
        {/* Header / drag handle */}
        <div
          onMouseDown={handleDragStart}
          style={{
            display: 'flex',
            flexDirection: 'column',
            cursor: 'grab',
            userSelect: 'none',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            background: accentColor + '10',
          }}
        >
          {/* Tab bar row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px 0 8px',
              gap: 2,
              overflowX: 'auto',
              minHeight: 34,
            }}
          >
            {/* Drag grip */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                padding: '0 4px',
                opacity: 0.3,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#6b7280' }} />
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#6b7280' }} />
              </div>
              <div style={{ display: 'flex', gap: 2 }}>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#6b7280' }} />
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#6b7280' }} />
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', flex: 1, gap: 1, overflow: 'hidden' }}>
              {tabs.map(tab => {
                const isActive = tab.sessionKey === activeTabKey
                const tabColor = tab.agentColor || '#8b5cf6'
                return (
                  <Tab
                    key={tab.sessionKey}
                    icon={tab.agentIcon || '🤖'}
                    name={tab.agentName}
                    isActive={isActive}
                    color={tabColor}
                    onClick={() => switchTab(tab.sessionKey)}
                    onClose={() => closeTab(tab.sessionKey)}
                  />
                )
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 4 }}>
              {onFocusAgent && activeTab && (
                <HeaderButton
                  onClick={() => onFocusAgent(activeTab.sessionKey)}
                  title="Focus agent"
                >
                  🎯
                </HeaderButton>
              )}
              <HeaderButton
                onClick={togglePin}
                title={chat.isPinned ? 'Unpin' : 'Pin'}
                active={chat.isPinned}
                activeColor={accentColor}
              >
                📌
              </HeaderButton>
              <HeaderButton onClick={toggleMinimize} title="Minimize">
                ─
              </HeaderButton>
              <HeaderButton onClick={closeChat} title="Close all">
                ✕
              </HeaderButton>
            </div>
          </div>

          {/* Active tab color line */}
          <div
            style={{
              height: 2,
              marginTop: 4,
              background: `linear-gradient(90deg, ${accentColor}00, ${accentColor}, ${accentColor}00)`,
            }}
          />
        </div>

        {/* Tab contents — all rendered, inactive hidden */}
        {tabs.map(tab => (
          <div
            key={tab.sessionKey}
            style={{
              display: tab.sessionKey === activeTabKey ? 'flex' : 'none',
              flexDirection: 'column',
              flex: 1,
              overflow: 'hidden',
            }}
          >
            <TabContent
              sessionKey={tab.sessionKey}
              agentName={tab.agentName}
              accentColor={tab.agentColor || '#8b5cf6'}
            />
          </div>
        ))}

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 20,
            height: 20,
            cursor: 'nwse-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
          }}
          title="Resize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.3 }}>
            <path d="M9 1L1 9M9 5L5 9M9 8L8 9" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
      <style>{floatingStyles}</style>
    </>
  )
}

// ── Tab ────────────────────────────────────────────────────────

function Tab({
  icon,
  name,
  isActive,
  color,
  onClick,
  onClose,
}: {
  icon: string
  name: string
  isActive: boolean
  color: string
  onClick: () => void
  onClose: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      data-tab
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        borderRadius: '8px 8px 0 0',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: isActive ? 600 : 400,
        color: isActive ? '#1f2937' : '#6b7280',
        background: isActive ? 'rgba(255,255,255,0.7)' : hovered ? 'rgba(255,255,255,0.3)' : 'transparent',
        borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
        maxWidth: 140,
        minWidth: 0,
        overflow: 'hidden',
        position: 'relative',
        transition: 'background 0.15s',
        flexShrink: 1,
      }}
    >
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          style={{
            width: 16,
            height: 16,
            borderRadius: 4,
            border: 'none',
            background: 'rgba(0,0,0,0.08)',
            color: '#9ca3af',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
            marginLeft: 2,
            lineHeight: 1,
            padding: 0,
          }}
          title={`Close ${name}`}
        >
          ✕
        </button>
      )}
    </div>
  )
}

// ── Header Button ──────────────────────────────────────────────

function HeaderButton({
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
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      title={title}
      style={{
        width: 26,
        height: 26,
        borderRadius: 7,
        border: 'none',
        background: active ? (activeColor ? activeColor + '20' : 'rgba(0,0,0,0.08)') : 'rgba(0,0,0,0.04)',
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
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active
          ? (activeColor ? activeColor + '20' : 'rgba(0,0,0,0.08)')
          : 'rgba(0,0,0,0.04)'
      }}
    >
      {children}
    </button>
  )
}

// ── Styles ─────────────────────────────────────────────────────

const floatingStyles = `
  @keyframes floatingChatSlideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  @keyframes floatingChatPulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 1; }
  }
`

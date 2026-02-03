import { useRef, useEffect, useState, type KeyboardEvent, type CSSProperties } from 'react'
import { useChatContext } from '@/contexts/ChatContext'
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

// ── Chat Content (inner) ───────────────────────────────────────

function ChatContent({
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
  const { chat, openChat, closeChat, togglePin, toggleMinimize } = useChatContext()
  const panelRef = useRef<HTMLDivElement>(null)

  const accentColor = chat.agentColor || '#8b5cf6'
  const agentIcon = chat.agentIcon || '🤖'
  const agentName = chat.agentName || 'Agent'

  // FAB: when closed but pinned with a session, show reopen button
  if (!chat.isOpen && chat.isPinned && chat.sessionKey) {
    return (
      <>
        <button
          onClick={() =>
            openChat(
              chat.sessionKey!,
              chat.agentName || 'Agent',
              chat.agentIcon || undefined,
              chat.agentColor || undefined
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
            background: accentColor,
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
          title={`Reopen chat with ${agentName}`}
        >
          {agentIcon}
        </button>
        <style>{floatingStyles}</style>
      </>
    )
  }

  // Not open, no FAB → nothing
  if (!chat.isOpen || !chat.sessionKey) return null

  // Minimized: header-only bar
  if (chat.isMinimized) {
    return (
      <>
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            width: 380,
            zIndex: 1001,
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRadius: 14,
            border: '1px solid rgba(0, 0, 0, 0.08)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.12)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            overflow: 'hidden',
            animation: 'floatingChatSlideUp 0.25s ease-out',
          }}
        >
          <PanelHeader
            agentIcon={agentIcon}
            agentName={agentName}
            accentColor={accentColor}
            isPinned={chat.isPinned}
            isMinimized={true}
            onTogglePin={togglePin}
            onToggleMinimize={toggleMinimize}
            onClose={closeChat}
          />
        </div>
        <style>{floatingStyles}</style>
      </>
    )
  }

  // Full panel
  return (
    <>
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 380,
          height: 520,
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
        <PanelHeader
          agentIcon={agentIcon}
          agentName={agentName}
          accentColor={accentColor}
          isPinned={chat.isPinned}
          isMinimized={false}
          onTogglePin={togglePin}
          onToggleMinimize={toggleMinimize}
          onClose={closeChat}
        />

        <ChatContent
          sessionKey={chat.sessionKey}
          agentName={agentName}
          accentColor={accentColor}
        />
      </div>
      <style>{floatingStyles}</style>
    </>
  )
}

// ── Panel Header ───────────────────────────────────────────────

function PanelHeader({
  agentIcon,
  agentName,
  accentColor,
  isPinned,
  isMinimized,
  onTogglePin,
  onToggleMinimize,
  onClose,
}: {
  agentIcon: string
  agentName: string
  accentColor: string
  isPinned: boolean
  isMinimized: boolean
  onTogglePin: () => void
  onToggleMinimize: () => void
  onClose: () => void
}) {
  return (
    <div
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: isMinimized ? 'none' : '1px solid rgba(0,0,0,0.06)',
        background: accentColor + '10',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* Agent icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: accentColor + '25',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {agentIcon}
      </div>

      {/* Name */}
      <div
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 700,
          color: '#1f2937',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {agentName}
      </div>

      {/* Pin */}
      <HeaderButton
        onClick={onTogglePin}
        title={isPinned ? 'Unpin (chat will close on navigation)' : 'Pin (keep open across navigation)'}
        active={isPinned}
        activeColor={accentColor}
      >
        📌
      </HeaderButton>

      {/* Minimize / Expand */}
      <HeaderButton
        onClick={onToggleMinimize}
        title={isMinimized ? 'Expand' : 'Minimize'}
      >
        {isMinimized ? '▢' : '─'}
      </HeaderButton>

      {/* Close */}
      <HeaderButton onClick={onClose} title="Close chat">
        ✕
      </HeaderButton>
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
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: 'none',
        background: active ? (activeColor ? activeColor + '20' : 'rgba(0,0,0,0.08)') : 'rgba(0,0,0,0.04)',
        color: active ? (activeColor || '#374151') : '#6b7280',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
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

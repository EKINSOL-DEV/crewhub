import { useRef, useEffect, useState, type KeyboardEvent, type CSSProperties } from 'react'
import { useAgentChat, type ChatMessageData } from '@/hooks/useAgentChat'
import type { BotVariantConfig } from './utils/botVariants'
import { parseMediaAttachments } from '@/utils/mediaParser'
import { ImageThumbnail } from '@/components/chat/ImageThumbnail'
import { formatShortTimestamp } from '@/lib/formatters'

interface AgentChatPanelProps {
  sessionKey: string
  botConfig: BotVariantConfig
  displayName: string
}

// ── Lightweight markdown ────────────────────────────────────────

function renderMarkdown(text: string): string {
  // Escape HTML first to prevent XSS
  let html = escapeHtml(text)

  // Code blocks
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, _lang, code) =>
      `<pre style="background:rgba(0,0,0,0.06);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:4px 0"><code>${code.trim()}</code></pre>`
  )
  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>'
  )
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Newlines → <br>
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
      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          color: '#9ca3af',
          fontStyle: 'italic',
          padding: '4px 0',
        }}
      >
        {msg.content}
      </div>
    )
  }

  // Parse media attachments from content
  const { text, attachments } = parseMediaAttachments(msg.content || '')
  const imageAttachments = attachments.filter(a => a.type === 'image')

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
      {/* Tool calls */}
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

      {/* Text content */}
      {text && (
        <div
          style={{
            padding: '8px 12px',
            fontSize: 13,
            lineHeight: 1.5,
            wordBreak: 'break-word',
            maxWidth: '100%',
            ...bubbleStyle,
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />
      )}

      {/* Image attachments */}
      {imageAttachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            maxWidth: '100%',
            ...(isUser ? { marginLeft: 48 } : { marginRight: 48 }),
          }}
        >
          {imageAttachments.map((attachment, i) => (
            <ImageThumbnail key={i} attachment={attachment} maxWidth={200} />
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div
        style={{
          fontSize: 10,
          color: '#9ca3af',
          padding: '0 4px',
        }}
      >
        {formatShortTimestamp(msg.timestamp)}
      </div>
    </div>
  )
}

// ── Main Panel ─────────────────────────────────────────────────

export function AgentChatPanel({
  sessionKey,
  botConfig,
  displayName,
}: AgentChatPanelProps) {
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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevMessageCount.current = messages.length
  }, [messages.length])

  // Initial scroll to bottom
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
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
        {/* Load older */}
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

        {/* Empty state */}
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
            }}
          >
            No messages yet. Say hello to {displayName}!
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} msg={msg} accentColor={botConfig.color} />
        ))}

        {/* Sending indicator */}
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
            <span style={{ animation: 'chatPulse 1s ease-in-out infinite' }}>●</span>
            {displayName} is thinking…
          </div>
        )}

        {/* Error */}
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
          placeholder={`Message ${displayName}…`}
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
                : botConfig.color + 'dd',
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

      {/* Pulse animation */}
      <style>{`
        @keyframes chatPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

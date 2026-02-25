import { useRef, useEffect, useState, type KeyboardEvent } from 'react'
import { useStreamingChat } from '@/hooks/useStreamingChat'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import type { BotVariantConfig } from './utils/botVariants'

interface AgentChatPanelProps {
  sessionKey: string
  botConfig: BotVariantConfig
  displayName: string
}

// ── Main Panel ─────────────────────────────────────────────────

export function AgentChatPanel({ sessionKey, botConfig, displayName }: AgentChatPanelProps) {
  const { messages, isSending, error, sendMessage, loadOlderMessages, hasMore, isLoadingHistory } =
    useStreamingChat(sessionKey, false)

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
          <ChatMessageBubble
            key={msg.id}
            msg={msg}
            variant="float"
            showThinking={false}
            showToolDetails={false}
          />
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
              isSending || !inputValue.trim() ? 'rgba(0,0,0,0.08)' : botConfig.color + 'dd',
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

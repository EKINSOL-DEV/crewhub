import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type CSSProperties } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { useAgentChat, type ChatMessageData } from '@/hooks/useAgentChat'
import { parseMediaAttachments } from '@/utils/mediaParser'
import { ImageThumbnail } from '@/components/chat/ImageThumbnail'
import type { CrewSession } from '@/lib/api'

// ── Helpers ────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  let html = text.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, _lang, code) =>
      `<pre style="background:rgba(255,255,255,0.05);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:4px 0"><code>${escapeHtml(code.trim())}</code></pre>`
  )
  html = html.replace(
    /`([^`]+)`/g,
    '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>'
  )
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/\n/g, '<br/>')
  return html
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Deterministic color
const AGENT_COLORS = [
  '#8b5cf6', '#06b6d4', '#f59e0b', '#ec4899', '#10b981',
  '#6366f1', '#f97316', '#14b8a6', '#a855f7', '#3b82f6',
]
function getColor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]
}

// ── Chat Bubble ────────────────────────────────────────────────

function ChatBubble({ msg, accentColor }: { msg: ChatMessageData; accentColor: string }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
        {msg.content}
      </div>
    )
  }

  const { text, attachments } = parseMediaAttachments(msg.content || '')
  const images = attachments.filter(a => a.type === 'image')

  // Tool calls summary
  const toolsSummary = msg.tools && msg.tools.length > 0 ? (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4,
      ...(isUser ? { justifyContent: 'flex-end' } : {}),
    }}>
      {msg.tools.map((tool, i) => (
        <span key={i} style={{
          fontSize: 10, padding: '2px 6px', borderRadius: 6,
          background: 'rgba(251, 191, 36, 0.12)',
          color: '#fbbf24',
        }}>
          🔧 {tool.name} {tool.status === 'done' || tool.status === 'called' ? '✓' : '✗'}
        </span>
      ))}
    </div>
  ) : null

  const bubbleStyle: CSSProperties = isUser
    ? {
        background: accentColor + 'cc',
        color: '#fff',
        borderRadius: '16px 16px 4px 16px',
        marginLeft: 48,
        alignSelf: 'flex-end',
      }
    : {
        background: 'rgba(255,255,255,0.07)',
        color: '#e2e8f0',
        borderRadius: '16px 16px 16px 4px',
        marginRight: 48,
        alignSelf: 'flex-start',
      }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      gap: 4,
    }}>
      {toolsSummary}
      {text && (
        <div
          style={{
            padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
            wordBreak: 'break-word', maxWidth: '100%', ...bubbleStyle,
          }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />
      )}
      {images.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6,
          ...(isUser ? { marginLeft: 48 } : { marginRight: 48 }),
        }}>
          {images.map((att, i) => (
            <ImageThumbnail key={i} attachment={att} maxWidth={180} />
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: '#475569', padding: '0 4px' }}>
        {formatTimestamp(msg.timestamp)}
      </div>
    </div>
  )
}

// ── Subagent Panel ─────────────────────────────────────────────

function SubagentPanel({ sessions }: { sessions: CrewSession[] }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (sessions.length === 0) return null

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(139, 92, 246, 0.04)',
    }}>
      <div style={{
        padding: '8px 16px 4px',
        fontSize: 11, fontWeight: 600, color: '#a78bfa',
        display: 'flex', alignItems: 'center', gap: 6,
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        <Zap size={12} />
        Active Tasks ({sessions.length})
      </div>
      {sessions.map(s => {
        const isExpanded = expandedKey === s.key
        const uuid = s.key.split(':subagent:')[1]?.slice(0, 8) || '?'
        const label = s.label || `Subagent ${uuid}`
        const elapsed = s.updatedAt ? getTimeSinceShort(s.updatedAt) : ''
        const lastMsg = s.messages?.[s.messages.length - 1]
        const preview = lastMsg?.content?.[0]?.text?.slice(0, 120) || ''

        return (
          <div key={s.key}>
            <button
              onClick={() => setExpandedKey(isExpanded ? null : s.key)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 16px', background: 'transparent', border: 'none',
                color: '#cbd5e1', fontSize: 13, cursor: 'pointer', textAlign: 'left',
              }}
            >
              {isExpanded ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: (Date.now() - s.updatedAt) < 300_000 ? '#22c55e' : '#64748b',
              }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <span style={{ fontSize: 10, color: '#475569', flexShrink: 0 }}>{elapsed}</span>
            </button>
            {isExpanded && preview && (
              <div style={{
                padding: '4px 16px 8px 46px',
                fontSize: 12, color: '#64748b', lineHeight: 1.4,
                wordBreak: 'break-word',
              }}>
                {preview}{preview.length >= 120 ? '…' : ''}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function getTimeSinceShort(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

// ── Main Component ─────────────────────────────────────────────

interface MobileAgentChatProps {
  sessionKey: string
  agentName: string
  agentIcon: string | null
  agentColor: string | null
  subagentSessions: CrewSession[]
  onBack: () => void
}

export function MobileAgentChat({
  sessionKey,
  agentName,
  agentIcon,
  agentColor,
  subagentSessions,
  onBack,
}: MobileAgentChatProps) {
  const accentColor = agentColor || getColor(sessionKey)
  const icon = agentIcon || agentName.charAt(0).toUpperCase()

  const {
    messages, isSending, error, sendMessage,
    loadOlderMessages, hasMore, isLoadingHistory,
  } = useAgentChat(sessionKey)

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)

  const handleScroll = useCallback(() => {
    const c = scrollContainerRef.current
    if (!c) return
    isNearBottomRef.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80
  }, [])

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      if (prevMessageCount.current === 0) {
        const c = scrollContainerRef.current
        if (c) c.scrollTop = c.scrollHeight
      } else if (isNearBottomRef.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    prevMessageCount.current = messages.length
  }, [messages.length])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200)
  }, [])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isSending) return
    setInputValue('')
    // Reset textarea height
    if (inputRef.current) inputRef.current.style.height = 'auto'
    await sendMessage(text)
  }, [inputValue, isSending, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 12px 10px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: 'none', background: 'transparent',
            color: '#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: accentColor + '25', color: accentColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, fontWeight: 600, flexShrink: 0,
        }}>
          {icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 600, color: '#f1f5f9',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {agentName}
          </div>
          <div style={{ fontSize: 11, color: isSending ? accentColor : '#64748b' }}>
            {isSending ? 'Thinking…' : 'Online'}
          </div>
        </div>
      </header>

      {/* Active Subagents */}
      <SubagentPanel sessions={subagentSessions} />

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1, overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}
      >
        {hasMore && (
          <button
            onClick={loadOlderMessages}
            disabled={isLoadingHistory}
            style={{
              alignSelf: 'center', padding: '6px 14px',
              borderRadius: 10, border: 'none',
              background: 'rgba(255,255,255,0.06)', color: '#64748b',
              cursor: isLoadingHistory ? 'wait' : 'pointer',
              fontSize: 12, fontWeight: 500,
            }}
          >
            {isLoadingHistory ? 'Loading…' : '↑ Load older'}
          </button>
        )}

        {!isLoadingHistory && messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            color: '#475569', fontSize: 14, padding: '40px 0', gap: 8,
          }}>
            <span style={{ fontSize: 40 }}>💬</span>
            <span>Say hello to {agentName}!</span>
          </div>
        )}

        {messages.map(msg => (
          <ChatBubble key={msg.id} msg={msg} accentColor={accentColor} />
        ))}

        {isSending && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 0', color: '#64748b', fontSize: 12,
          }}>
            <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
            {agentName} is thinking…
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5',
            fontSize: 12, alignSelf: 'center',
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '10px 12px calc(env(safe-area-inset-bottom, 8px) + 10px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 8, alignItems: 'flex-end',
        background: '#0f172a',
      }}>
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${agentName}…`}
          disabled={isSending}
          rows={1}
          style={{
            flex: 1, padding: '10px 14px',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.05)',
            color: '#e2e8f0', fontSize: 16,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            resize: 'none', outline: 'none',
            maxHeight: 100, lineHeight: 1.4,
          }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 100) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={isSending || !inputValue.trim()}
          style={{
            width: 42, height: 42, borderRadius: 14,
            border: 'none',
            background: isSending || !inputValue.trim()
              ? 'rgba(255,255,255,0.06)' : accentColor,
            color: isSending || !inputValue.trim() ? '#475569' : '#fff',
            cursor: isSending || !inputValue.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          ➤
        </button>
      </div>
    </>
  )
}

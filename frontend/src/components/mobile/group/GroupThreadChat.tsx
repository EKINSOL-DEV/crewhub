import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useThreadChat } from '@/hooks/useThreadChat'
import type { Thread, ThreadMessage } from '@/lib/threads.api'
import { ParticipantAvatarStack } from './ParticipantAvatarStack'
import { ParticipantListSheet } from './ParticipantListSheet'
import { RoutingSelector } from './RoutingSelector'

// ── Helpers ────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  let html = text.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, _lang, code) =>
      `<pre style="background:rgba(255,255,255,0.05);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:4px 0"><code>${escapeHtml(code.trim())}</code></pre>`
  )
  html = html.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
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

// ── Message Bubble ─────────────────────────────────────────────

function GroupMessageBubble({ msg }: { msg: ThreadMessage }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', fontStyle: 'italic', padding: '4px 0' }}>
        {msg.content}
      </div>
    )
  }

  const bubbleStyle: CSSProperties = isUser
    ? {
        background: '#6366f1cc',
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
      gap: 2,
    }}>
      {/* Agent name badge for assistant messages */}
      {!isUser && msg.agent_name && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: msg.agent_id ? '#94a3b8' : '#64748b',
          padding: '0 4px', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ fontSize: 12 }}>
            {/* Agent icon placeholder */}
          </span>
          {msg.agent_name}
        </div>
      )}
      <div
        style={{
          padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
          wordBreak: 'break-word', maxWidth: '100%', ...bubbleStyle,
        }}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
      />
      <div style={{ fontSize: 10, color: '#475569', padding: '0 4px' }}>
        {formatTimestamp(msg.created_at)}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

interface GroupThreadChatProps {
  thread: Thread
  onBack: () => void
  onRemoveParticipant: (agentId: string) => void
  onAddParticipants: () => void
  onRename: () => void
}

export function GroupThreadChat({
  thread,
  onBack,
  onRemoveParticipant,
  onAddParticipants,
  onRename,
}: GroupThreadChatProps) {
  const {
    messages, isSending, error, sendMessage,
    loadOlderMessages, hasMore, isLoadingHistory,
  } = useThreadChat(thread.id)

  const [inputValue, setInputValue] = useState('')
  const [showParticipants, setShowParticipants] = useState(false)
  const [routingMode, setRoutingMode] = useState<'broadcast' | 'targeted'>('broadcast')
  const [targetAgentIds, setTargetAgentIds] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)

  const title = thread.title || thread.title_auto || 'Group Chat'
  const activeParticipants = thread.participants.filter(p => p.is_active)
  const onlineCount = activeParticipants.length // TODO: real presence

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
    if (inputRef.current) inputRef.current.style.height = 'auto'

    const targets = routingMode === 'targeted' && targetAgentIds.length > 0
      ? targetAgentIds
      : undefined

    await sendMessage(text, routingMode, targets)
  }, [inputValue, isSending, sendMessage, routingMode, targetAgentIds])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Header */}
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 12px 10px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0, cursor: 'pointer',
        }}
        onClick={() => setShowParticipants(true)}
      >
        <button
          onClick={e => { e.stopPropagation(); onBack() }}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: 'none', background: 'transparent',
            color: '#94a3b8', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <ParticipantAvatarStack participants={activeParticipants} size={32} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: '#f1f5f9',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {title}
          </div>
          <div style={{ fontSize: 11, color: isSending ? '#818cf8' : '#64748b' }}>
            {isSending ? 'Agents thinking…' : `${onlineCount} of ${activeParticipants.length} online`}
          </div>
        </div>
      </header>

      {/* Participants sheet */}
      {showParticipants && (
        <ParticipantListSheet
          participants={activeParticipants}
          threadTitle={thread.title}
          onClose={() => setShowParticipants(false)}
          onRemoveParticipant={onRemoveParticipant}
          onAddParticipants={onAddParticipants}
          onRename={onRename}
        />
      )}

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
            <span style={{ fontSize: 40 }}>👥</span>
            <span>Start chatting with the crew!</span>
          </div>
        )}

        {messages.map(msg => (
          <GroupMessageBubble key={msg.id} msg={msg} />
        ))}

        {isSending && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 0', color: '#64748b', fontSize: 12,
          }}>
            <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
            Agents are thinking…
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 10,
            background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
            fontSize: 12, alignSelf: 'center',
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Routing selector */}
      <RoutingSelector
        participants={activeParticipants}
        mode={routingMode}
        targetAgentIds={targetAgentIds}
        onModeChange={setRoutingMode}
        onTargetChange={setTargetAgentIds}
      />

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
          placeholder="Message the crew…"
          disabled={isSending}
          rows={1}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 14,
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
            width: 44, height: 44, borderRadius: 14,
            border: 'none',
            background: isSending || !inputValue.trim() ? 'rgba(255,255,255,0.06)' : '#6366f1',
            color: isSending || !inputValue.trim() ? '#475569' : '#fff',
            cursor: isSending || !inputValue.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}
        >
          ➤
        </button>
      </div>
    </>
  )
}

/**
 * Zen Mode Chat Panel
 * Full chat interface reusing the existing useAgentChat hook
 */

import { useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { useState } from 'react'
import { useAgentChat, type ChatMessageData, type ToolCallData } from '@/hooks/useAgentChat'

interface ZenChatPanelProps {
  sessionKey: string | null
  agentName: string | null
  agentIcon: string | null
  onStatusChange?: (status: 'active' | 'thinking' | 'idle' | 'error') => void
  onChangeAgent?: () => void  // Callback to open agent picker
  onSelectAgent?: (agentId: string, agentName: string, agentIcon: string) => void  // Direct agent selection
}

// ── Lightweight markdown rendering ─────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderMarkdown(text: string): string {
  // Code blocks
  let html = text.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, _lang, code) =>
      `<pre><code>${escapeHtml(code.trim())}</code></pre>`
  )
  // Inline code
  html = html.replace(
    /`([^`]+)`/g,
    '<code>$1</code>'
  )
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Line breaks
  html = html.replace(/\n/g, '<br/>')
  return html
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

// ── Tool Call Component ────────────────────────────────────────

function ToolCall({ tool }: { tool: ToolCallData }) {
  const isSuccess = tool.status === 'done' || tool.status === 'called'
  
  return (
    <div className="zen-tool-call">
      <span className="zen-tool-icon">🔧</span>
      <span className="zen-tool-name">{tool.name}</span>
      <span className={`zen-tool-status ${isSuccess ? 'zen-tool-status-success' : 'zen-tool-status-error'}`}>
        {isSuccess ? '✓' : '✗'}
      </span>
    </div>
  )
}

// ── Message Component ──────────────────────────────────────────

function Message({ msg }: { msg: ChatMessageData }) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  if (isSystem) {
    return (
      <div 
        className="zen-message zen-message-system zen-fade-in"
        style={{ 
          alignSelf: 'center', 
          color: 'var(--zen-fg-muted)', 
          fontStyle: 'italic',
          fontSize: '12px',
          padding: 'var(--zen-space-sm) 0'
        }}
      >
        {msg.content}
      </div>
    )
  }

  return (
    <div className={`zen-message ${isUser ? 'zen-message-user' : 'zen-message-assistant'} zen-fade-in`}>
      <div className="zen-message-header">
        <span className={`zen-message-role ${isUser ? 'zen-message-role-user' : 'zen-message-role-assistant'}`}>
          {isUser ? 'YOU' : 'ASSISTANT'}
        </span>
        <span className="zen-message-time">{formatRelativeTime(msg.timestamp)}</span>
      </div>
      
      {/* Thinking blocks */}
      {msg.thinking && msg.thinking.length > 0 && (
        <div className="zen-thinking-blocks">
          {msg.thinking.map((thought, i) => (
            <div key={i} className="zen-thinking-block">
              <div className="zen-thinking-block-header">
                <span>🧠</span>
                <span>Thinking</span>
              </div>
              <div className="zen-thinking-block-content">
                {thought.length > 500 ? thought.slice(0, 500) + '...' : thought}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Tool calls */}
      {msg.tools && msg.tools.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
          {msg.tools.map((tool, i) => (
            <ToolCall key={i} tool={tool} />
          ))}
        </div>
      )}
      
      {/* Message content */}
      {msg.content && (
        <div 
          className="zen-message-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
      )}
    </div>
  )
}

// ── Empty State ────────────────────────────────────────────────

function EmptyState({ agentName, agentIcon }: { agentName: string | null; agentIcon: string | null }) {
  return (
    <div className="zen-empty-state">
      <div className="zen-empty-icon">{agentIcon || '🧘'}</div>
      <div className="zen-empty-title">
        {agentName ? `Chat with ${agentName}` : 'Select an agent to start'}
      </div>
      <div className="zen-empty-subtitle">
        {agentName 
          ? 'Send a message to begin the conversation'
          : 'Use the sidebar or command palette to select an agent'
        }
      </div>
    </div>
  )
}

// ── Fixed Agents for Quick Selection ───────────────────────────

const FIXED_AGENTS = [
  { id: 'main', name: 'Assistent', icon: '🧠', description: 'Primary assistant for general tasks' },
  { id: 'dev', name: 'Dev', icon: '💻', description: 'Development and coding tasks' },
  { id: 'flowy', name: 'Flowy', icon: '🌊', description: 'Flow and automation tasks' },
  { id: 'reviewer', name: 'Reviewer', icon: '🔍', description: 'Code review and analysis' },
]

// ── No Agent Selected State ────────────────────────────────────

interface NoAgentStateProps {
  onSelectAgent?: (agentId: string, agentName: string, agentIcon: string) => void
}

function NoAgentState({ onSelectAgent }: NoAgentStateProps) {
  return (
    <div className="zen-empty-state">
      <div className="zen-empty-icon">🧘</div>
      <div className="zen-empty-title">Select an Agent</div>
      <div className="zen-empty-subtitle" style={{ marginBottom: '16px' }}>
        Choose an agent to start chatting
      </div>
      
      {onSelectAgent && (
        <div className="zen-agent-grid">
          {FIXED_AGENTS.map(agent => (
            <button
              key={agent.id}
              className="zen-agent-option"
              onClick={() => onSelectAgent(agent.id, agent.name, agent.icon)}
            >
              <span className="zen-agent-option-icon">{agent.icon}</span>
              <div className="zen-agent-option-info">
                <span className="zen-agent-option-name">{agent.name}</span>
                <span className="zen-agent-option-desc">{agent.description}</span>
              </div>
            </button>
          ))}
        </div>
      )}
      
      <div className="zen-empty-subtitle" style={{ marginTop: '16px' }}>
        <kbd className="zen-kbd">Ctrl+N</kbd> New chat
        <span style={{ margin: '0 8px', opacity: 0.5 }}>•</span>
        <kbd className="zen-kbd">Ctrl+K</kbd> Commands
      </div>
    </div>
  )
}

// ── Main Chat Panel ────────────────────────────────────────────

export function ZenChatPanel({ 
  sessionKey, 
  agentName, 
  agentIcon,
  onStatusChange,
  onChangeAgent,
  onSelectAgent,
}: ZenChatPanelProps) {
  const [showThinking, setShowThinking] = useState(false)
  
  const {
    messages,
    isSending,
    error,
    sendMessage,
    loadOlderMessages,
    hasMore,
    isLoadingHistory,
  } = useAgentChat(sessionKey || '', showThinking)

  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)

  // Notify parent of status changes
  useEffect(() => {
    if (!onStatusChange) return
    if (error) {
      onStatusChange('error')
    } else if (isSending) {
      onStatusChange('thinking')
    } else if (messages.length > 0) {
      onStatusChange('active')
    } else {
      onStatusChange('idle')
    }
  }, [isSending, error, messages.length, onStatusChange])

  // Check if near bottom
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const threshold = 100
    isNearBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < threshold
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      if (prevMessageCount.current === 0) {
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
    if (sessionKey) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [sessionKey])
  
  // Keyboard shortcut for thinking toggle (Ctrl+.)
  // Note: Ctrl+T conflicts with browser's "new tab" shortcut
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Guard: ignore when typing in inputs/textareas
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable
      if (isInput) return
      
      // Ctrl+. to toggle thinking
      if (e.ctrlKey && e.key === '.' && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        setShowThinking(v => !v)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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

  // Auto-resize textarea
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  // If no session key, show no agent state with agent picker
  if (!sessionKey) {
    return (
      <div className="zen-chat-panel">
        <NoAgentState onSelectAgent={onSelectAgent} />
      </div>
    )
  }

  return (
    <div className="zen-chat-panel">
      {/* Chat header with agent info and controls */}
      <div className="zen-chat-header">
        <div className="zen-chat-header-left">
          {onChangeAgent ? (
            <button 
              type="button"
              className="zen-chat-agent-selector"
              onClick={onChangeAgent}
              title="Switch agent (click to change)"
            >
              <span className="zen-chat-agent-icon">{agentIcon || '🤖'}</span>
              <span className="zen-chat-agent-name">{agentName || 'Agent'}</span>
              <span className="zen-chat-agent-chevron">▾</span>
            </button>
          ) : (
            <>
              <span className="zen-chat-agent-icon">{agentIcon || '🤖'}</span>
              <span className="zen-chat-agent-name">{agentName || 'Agent'}</span>
            </>
          )}
        </div>
        <div className="zen-chat-header-right">
          <button
            type="button"
            className={`zen-btn zen-btn-thinking ${showThinking ? 'zen-btn-thinking-active' : ''}`}
            onClick={() => setShowThinking(!showThinking)}
            title={showThinking ? 'Hide thinking (Ctrl+.)' : 'Show thinking (Ctrl+.)'}
          >
            <span className="zen-thinking-icon">🧠</span>
            <span className="zen-thinking-label">{showThinking ? 'On' : 'Off'}</span>
          </button>
        </div>
      </div>
      
      {/* Messages area */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="zen-chat-messages"
      >
        {/* Load older button */}
        {hasMore && (
          <button
            type="button"
            onClick={loadOlderMessages}
            disabled={isLoadingHistory}
            className="zen-btn"
            style={{ alignSelf: 'center', marginBottom: 'var(--zen-space-md)' }}
          >
            {isLoadingHistory ? 'Loading...' : '↑ Load older messages'}
          </button>
        )}

        {/* Empty state */}
        {!isLoadingHistory && messages.length === 0 && (
          <EmptyState agentName={agentName} agentIcon={agentIcon} />
        )}

        {/* Messages */}
        {messages.map(msg => (
          <Message key={msg.id} msg={msg} />
        ))}

        {/* Thinking indicator */}
        {isSending && (
          <div className="zen-thinking">
            <div className="zen-thinking-dots">
              <span />
              <span />
              <span />
            </div>
            <span>{agentName || 'Agent'} is thinking...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="zen-error">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="zen-chat-input-container">
        <div className="zen-chat-input-wrapper">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={`Message ${agentName || 'agent'}...`}
            disabled={isSending}
            rows={1}
            className="zen-chat-input"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || !inputValue.trim()}
            className="zen-chat-send-btn"
            aria-label="Send message"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}

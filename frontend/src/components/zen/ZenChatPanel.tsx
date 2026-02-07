/**
 * Zen Mode Chat Panel
 * Full chat interface reusing the existing useAgentChat hook
 */

import { useRef, useEffect, useCallback, useState, type KeyboardEvent } from 'react'
import { useAgentChat, type ChatMessageData, type ToolCallData } from '@/hooks/useAgentChat'
import { parseMediaAttachments } from '@/utils/mediaParser'
import { ImageThumbnail } from '@/components/chat/ImageThumbnail'
import { VideoThumbnail } from '@/components/chat/VideoThumbnail'
import { PixelAvatar } from './PixelAvatar'
import { ImageDropZone, ImagePreviews, type PendingImage } from './ImageDropZone'

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
  let html = text
  
  // Code blocks (must be first to protect content)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, lang, code) =>
      `<pre class="zen-md-codeblock" data-lang="${lang}"><code>${escapeHtml(code.trim())}</code></pre>`
  )
  
  // Inline code (protect from other replacements)
  const inlineCodePlaceholders: string[] = []
  html = html.replace(/`([^`]+)`/g, (_m, code) => {
    const placeholder = `%%INLINE_CODE_${inlineCodePlaceholders.length}%%`
    inlineCodePlaceholders.push(`<code class="zen-md-inline-code">${escapeHtml(code)}</code>`)
    return placeholder
  })
  
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 class="zen-md-h3">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="zen-md-h2">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 class="zen-md-h1">$1</h2>')
  
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="zen-md-blockquote">$1</blockquote>')
  
  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="zen-md-hr" />')
  
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')
  
  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="zen-md-link">$1</a>')
  
  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="zen-md-li">$1</li>')
  html = html.replace(/(<li class="zen-md-li">.*<\/li>\n?)+/g, '<ul class="zen-md-ul">$&</ul>')
  
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="zen-md-li-ordered">$1</li>')
  html = html.replace(/(<li class="zen-md-li-ordered">.*<\/li>\n?)+/g, '<ol class="zen-md-ol">$&</ol>')
  
  // Restore inline code
  inlineCodePlaceholders.forEach((code, i) => {
    html = html.replace(`%%INLINE_CODE_${i}%%`, code)
  })
  
  // Line breaks (but not inside lists/blockquotes)
  html = html.replace(/\n/g, '<br/>')
  
  // Clean up extra breaks after block elements
  html = html.replace(/<\/(h[234]|blockquote|ul|ol|pre|hr)><br\/>/g, '</$1>')
  html = html.replace(/<br\/><(h[234]|blockquote|ul|ol|pre)/g, '<$1')
  
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

// ── Thinking Block Component ───────────────────────────────────

function ThinkingBlock({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isLong = content.length > 500
  
  return (
    <div className="zen-thinking-block">
      <button
        type="button"
        className="zen-thinking-block-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>🧠</span>
        <span>Thinking</span>
        {isLong && (
          <span className="zen-thinking-block-toggle">
            {isExpanded ? '▾ collapse' : '▸ expand'}
          </span>
        )}
      </button>
      <div className={`zen-thinking-block-content ${isExpanded ? 'zen-thinking-block-expanded' : ''}`}>
        {isExpanded || !isLong ? content : content.slice(0, 500) + '...'}
      </div>
    </div>
  )
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
  
  // Parse media attachments from content
  const { text, attachments } = parseMediaAttachments(msg.content || '')
  const imageAttachments = attachments.filter(a => a.type === 'image')
  const videoAttachments = attachments.filter(a => a.type === 'video')

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
        {text}
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
      
      {/* Image attachments */}
      {imageAttachments.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '8px', 
          marginBottom: '8px' 
        }}>
          {imageAttachments.map((attachment, i) => (
            <ImageThumbnail key={i} attachment={attachment} maxWidth={200} />
          ))}
        </div>
      )}
      
      {/* Video attachments */}
      {videoAttachments.length > 0 && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          gap: '8px', 
          marginBottom: '8px' 
        }}>
          {videoAttachments.map((attachment, i) => (
            <VideoThumbnail key={i} attachment={attachment} maxWidth={300} />
          ))}
        </div>
      )}
      
      {/* Thinking blocks */}
      {msg.thinking && msg.thinking.length > 0 && (
        <div className="zen-thinking-blocks">
          {msg.thinking.map((thought, i) => (
            <ThinkingBlock key={i} content={thought} />
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
      {text && (
        <div 
          className="zen-message-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
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

// ── Agent Dropdown Component ───────────────────────────────────

interface AgentDropdownProps {
  currentAgentName: string | null
  currentAgentIcon: string | null
  onSelectAgent?: (agentId: string, agentName: string, agentIcon: string) => void
  onOpenPicker?: () => void
}

function AgentDropdown({ currentAgentName, currentAgentIcon: _currentAgentIcon, onSelectAgent, onOpenPicker }: AgentDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])
  
  // Close on escape
  useEffect(() => {
    if (!isOpen) return
    
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])
  
  const handleSelect = useCallback((agent: typeof FIXED_AGENTS[0]) => {
    onSelectAgent?.(agent.id, agent.name, agent.icon)
    setIsOpen(false)
  }, [onSelectAgent])
  
  return (
    <div className="zen-agent-dropdown" ref={dropdownRef}>
      <button 
        type="button"
        className="zen-chat-agent-selector zen-chat-agent-selector-minimal"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch agent (click to change)"
      >
        <span className="zen-chat-agent-name">{currentAgentName || 'Agent'}</span>
        <span className="zen-chat-agent-chevron">▾</span>
      </button>
      
      {isOpen && (
        <div className="zen-agent-dropdown-menu">
          {FIXED_AGENTS.map(agent => (
            <button
              key={agent.id}
              className={`zen-agent-dropdown-item ${currentAgentName === agent.name ? 'active' : ''}`}
              onClick={() => handleSelect(agent)}
            >
              <span className="zen-agent-dropdown-icon">{agent.icon}</span>
              <span className="zen-agent-dropdown-name">{agent.name}</span>
            </button>
          ))}
          {onOpenPicker && (
            <>
              <div className="zen-context-menu-separator" />
              <button
                className="zen-agent-dropdown-item"
                onClick={() => {
                  setIsOpen(false)
                  onOpenPicker()
                }}
              >
                <span className="zen-agent-dropdown-icon">➕</span>
                <span className="zen-agent-dropdown-name">More agents...</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

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
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)

  // Process pending message when agent finishes
  useEffect(() => {
    if (!isSending && pendingMessage) {
      sendMessage(pendingMessage)
      setPendingMessage(null)
    }
  }, [isSending, pendingMessage, sendMessage])

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
      // Small delay to allow images to load and get their height
      const scrollToBottom = () => {
        if (prevMessageCount.current === 0) {
          const container = scrollContainerRef.current
          if (container) {
            container.scrollTop = container.scrollHeight
          }
        } else if (isNearBottomRef.current) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
      }
      
      // Immediate scroll + delayed scroll for images
      scrollToBottom()
      setTimeout(scrollToBottom, 150)
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
    
    // Check if images are still uploading
    const stillUploading = pendingImages.some(img => img.uploading)
    if (stillUploading) {
      // Wait for uploads to complete before sending
      return
    }
    
    // Check if there are uploaded images
    const uploadedImages = pendingImages.filter(img => img.uploadedPath && !img.error)
    const hasImages = uploadedImages.length > 0
    
    // Need text or images to send
    if (!text && !hasImages) return
    
    // Build message with image attachments
    let messageText = text
    if (hasImages) {
      // Append media tags for each image
      const mediaTags = uploadedImages.map(img => 
        `[media attached: ${img.uploadedPath} (${img.file.type})]`
      ).join('\n')
      messageText = text ? `${text}\n\n${mediaTags}` : mediaTags
    }
    
    // Clear inputs
    setInputValue('')
    
    // Revoke preview URLs and clear images
    pendingImages.forEach(img => URL.revokeObjectURL(img.preview))
    setPendingImages([])
    
    if (isSending) {
      // Queue the message for when agent finishes
      setPendingMessage(messageText)
    } else {
      await sendMessage(messageText)
    }
    // Refocus input after sending
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [inputValue, isSending, sendMessage, pendingImages])
  
  // Remove a pending image
  const handleRemoveImage = useCallback((id: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== id))
  }, [])

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

  // Check if we can send (has text or uploaded images, and nothing uploading)
  const uploadedImages = pendingImages.filter(img => img.uploadedPath && !img.error)
  const stillUploading = pendingImages.some(img => img.uploading)
  const canSend = (inputValue.trim() || uploadedImages.length > 0) && !stillUploading

  return (
    <div className="zen-chat-panel">
      {/* Chat header with agent info and controls */}
      <div className="zen-chat-header">
        <div className="zen-chat-header-left">
          <PixelAvatar 
            agentName={agentName}
            status={error ? 'error' : isSending ? 'thinking' : messages.length > 0 ? 'active' : 'idle'}
            stats={{
              tokens: undefined, // TODO: get from session
              uptime: undefined, // TODO: calculate from session start
              model: undefined,  // TODO: get from session
            }}
          />
          <AgentDropdown
            currentAgentName={agentName}
            currentAgentIcon={agentIcon}
            onSelectAgent={onSelectAgent}
            onOpenPicker={onChangeAgent}
          />
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
      
      {/* Wrap messages and input with drop zone for image paste/drop */}
      <ImageDropZone
        images={pendingImages}
        onImagesChange={setPendingImages}
        disabled={isSending}
      >
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

        {/* Image previews (above input) */}
        <ImagePreviews images={pendingImages} onRemove={handleRemoveImage} />

        {/* Input area */}
        <div className="zen-chat-input-container">
          <div className="zen-chat-input-wrapper">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={`Message ${agentName || 'agent'}... (paste or drop images)`}
              rows={1}
              className="zen-chat-input"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || pendingMessage !== null}
              className="zen-chat-send-btn"
              aria-label={isSending ? "Queue message" : "Send message"}
              title={isSending ? "Message will be sent when agent finishes" : "Send message"}
            >
              {pendingMessage ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      </ImageDropZone>
    </div>
  )
}

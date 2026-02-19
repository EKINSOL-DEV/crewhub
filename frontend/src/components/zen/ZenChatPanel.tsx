/**
 * Zen Mode Chat Panel
 * Full chat interface reusing the existing useAgentChat hook
 */

import { useRef, useEffect, useCallback, useState, type KeyboardEvent } from 'react'
import { useStreamingChat } from '@/hooks/useStreamingChat'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { PixelAvatar } from './PixelAvatar'
import { ImageDropZone, ImagePreviews, type PendingImage } from './ImageDropZone'
import { API_BASE } from '@/lib/api'
import type { Agent } from '@/hooks/useAgentsRegistry'
import { useVoiceRecorder, formatDuration } from '@/hooks/useVoiceRecorder'

interface ZenChatPanelProps {
  sessionKey: string | null
  agentName: string | null
  agentIcon: string | null
  roomId?: string  // Room ID for context envelope (Zen Mode active project room)
  onStatusChange?: (status: 'active' | 'thinking' | 'idle' | 'error') => void
  onChangeAgent?: () => void  // Callback to open agent picker
  onSelectAgent?: (agentId: string, agentName: string, agentIcon: string) => void  // Direct agent selection
}

// (renderMarkdown, ThinkingBlock, ToolCall, Message all moved to ChatMessageBubble.tsx)

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

// ── Agent list hook ────────────────────────────────────────────

function useFixedAgents() {
  const [agents, setAgents] = useState<Agent[]>([])
  useEffect(() => {
    fetch(`${API_BASE}/agents`)
      .then(r => r.json())
      .then(data => setAgents(data.agents ?? []))
      .catch(() => {}) // silently fail, list stays empty
  }, [])
  return agents
}

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
  
  const fixedAgents = useFixedAgents()

  const handleSelect = useCallback((agent: Agent) => {
    onSelectAgent?.(agent.id, agent.name ?? agent.id, agent.icon ?? '🤖')
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
          {fixedAgents.map(agent => (
            <button
              key={agent.id}
              className={`zen-agent-dropdown-item ${currentAgentName === agent.name ? 'active' : ''}`}
              onClick={() => handleSelect(agent)}
            >
              <span className="zen-agent-dropdown-icon">{agent.icon ?? '🤖'}</span>
              <span className="zen-agent-dropdown-name">{agent.name ?? agent.id}</span>
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
  const fixedAgents = useFixedAgents()
  return (
    <div className="zen-empty-state">
      <div className="zen-empty-icon">🧘</div>
      <div className="zen-empty-title">Select an Agent</div>
      <div className="zen-empty-subtitle" style={{ marginBottom: '16px' }}>
        Choose an agent to start chatting
      </div>
      
      {onSelectAgent && (
        <div className="zen-agent-grid">
          {fixedAgents.map(agent => (
            <button
              key={agent.id}
              className="zen-agent-option"
              onClick={() => onSelectAgent(agent.id, agent.name ?? agent.id, agent.icon ?? '🤖')}
            >
              <span className="zen-agent-option-icon">{agent.icon ?? '🤖'}</span>
              <div className="zen-agent-option-info">
                <span className="zen-agent-option-name">{agent.name ?? agent.id}</span>
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
  roomId,
  onStatusChange,
  onChangeAgent,
  onSelectAgent,
}: ZenChatPanelProps) {
  const [showThinking, setShowThinking] = useState(false)
  
  const {
    messages,
    isSending,
    streamingMessageId,
    error,
    sendMessage,
    loadOlderMessages,
    hasMore,
    isLoadingHistory,
  } = useStreamingChat(sessionKey || '', showThinking, roomId)

  const [inputValue, setInputValue] = useState('')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)
  const prevStreamingIdRef = useRef<string | null>(null)

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

  // Focus input and scroll to bottom on mount/session switch
  useEffect(() => {
    if (sessionKey) {
      setTimeout(() => inputRef.current?.focus(), 150)
      // Scroll to bottom when entering Zen Mode or switching sessions
      setTimeout(() => {
        const container = scrollContainerRef.current
        if (container) {
          container.scrollTop = container.scrollHeight
        }
      }, 200)
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

  // ── Voice recording ─────────────────────────────────────────
  const handleAudioReady = useCallback((url: string, duration: number, transcript: string | null, transcriptError: string | null) => {
    let tag = `[audio attached: ${url} (audio/webm) ${duration}s]`
    if (transcript) {
      tag += `\nTranscript: "${transcript}"`
    } else if (transcriptError) {
      tag += `\n[Voice transcription unavailable: ${transcriptError}]`
    }
    sendMessage(tag)
  }, [sendMessage])

  const {
    isRecording,
    isPreparing,
    duration: recDuration,
    error: recError,
    isSupported: micSupported,
    pendingAudio,
    startRecording,
    stopRecording,
    cancelRecording,
    confirmAudio,
    cancelAudio,
  } = useVoiceRecorder(handleAudioReady)

  // ESC cancels recording or pending audio preview
  useEffect(() => {
    if (!isRecording && !pendingAudio) return
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRecording) cancelRecording()
        else if (pendingAudio) cancelAudio()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isRecording, pendingAudio, cancelRecording, cancelAudio])

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
            <ChatMessageBubble
              key={msg.id}
              msg={msg}
              variant="zen"
              showThinking={showThinking}
            />
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
          {/* Pending audio preview — shown after stop, before send */}
          {pendingAudio && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 6,
              padding: '8px 12px',
              background: 'rgba(139,92,246,0.06)',
              borderTop: '1px solid rgba(139,92,246,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <audio
                  src={pendingAudio.url}
                  controls
                  style={{ flex: 1, height: 32, minWidth: 0 }}
                />
                {/* Send (confirm) button */}
                <button
                  type="button"
                  onClick={confirmAudio}
                  title="Send voice message"
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: 'none',
                    background: '#8b5cf6', color: '#fff',
                    cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}
                >
                  ➤
                </button>
                {/* Cancel (discard) button */}
                <button
                  type="button"
                  onClick={cancelAudio}
                  title="Discard voice message"
                  style={{
                    width: 32, height: 32, borderRadius: 8, border: 'none',
                    background: 'rgba(0,0,0,0.06)', color: '#6b7280',
                    cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              </div>
              {/* Transcript preview */}
              {pendingAudio.transcript && (
                <div style={{
                  fontSize: 12, fontStyle: 'italic',
                  color: 'var(--zen-fg-muted)',
                  paddingLeft: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                }}>
                  "{pendingAudio.transcript}"
                </div>
              )}
              {pendingAudio.transcriptError && (
                <div style={{ fontSize: 11, color: '#9ca3af', paddingLeft: 2 }}>
                  Transcription unavailable
                </div>
              )}
            </div>
          )}

          {/* Recording indicator */}
          {isRecording && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px 2px',
              fontSize: 12, color: '#ef4444',
              fontFamily: 'monospace',
            }}>
              <span style={{ animation: 'streaming-cursor-blink 0.6s step-end infinite' }}>●</span>
              Recording {formatDuration(recDuration)}
              <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.7, color: 'var(--zen-fg-muted)' }}>
                ESC to cancel
              </span>
            </div>
          )}
          {recError && (
            <div style={{ padding: '4px 12px', fontSize: 11, color: '#ef4444' }}>{recError}</div>
          )}
          <div className="zen-chat-input-wrapper">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={isRecording ? 'Recording…' : `Message ${agentName || 'agent'}... (paste or drop images)`}
              rows={1}
              className="zen-chat-input"
              disabled={isRecording || !!pendingAudio}
            />
            {/* Mic button — hidden while there's a pending audio preview */}
            {micSupported && !pendingAudio && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isPreparing || isSending}
                className="zen-chat-send-btn"
                style={isRecording ? { color: '#ef4444', background: 'rgba(239,68,68,0.12)' } : undefined}
                aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
                title={isRecording ? 'Stop recording' : 'Record voice message'}
              >
                {isPreparing ? '⏳' : isRecording ? '⏹' : '🎤'}
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend || pendingMessage !== null || isRecording || !!pendingAudio}
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

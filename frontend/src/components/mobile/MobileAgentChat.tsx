import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react'
import { ArrowLeft, ArrowUp, Paperclip, X, Settings as SettingsIcon, Mic } from 'lucide-react'
import { useStreamingChat } from '@/hooks/useStreamingChat'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { useVoiceRecorder, formatDuration } from '@/hooks/useVoiceRecorder'
import { API_BASE } from '@/lib/api'
import type { CrewSession } from '@/lib/api'
import { ActiveTasksBadge, ActiveTasksOverlay } from './ActiveTasksOverlay'
import { type AgentStatus } from './AgentCameraView'
import { getBotConfigFromSession } from '@/components/world3d/utils/botVariants'
import { formatFileSize } from '@/lib/formatters'
import { ChatHeader3DAvatar, type AvatarAnimation } from './ChatHeader3DAvatar'

// ── File Upload Types & Helpers ────────────────────────────────

interface PendingFile {
  id: string
  file: File
  previewUrl: string | null
  uploading: boolean
  progress: number
  error: string | null
  uploadedPath: string | null
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function isImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.includes(file.type)
}

async function uploadFile(file: File): Promise<{ path: string; url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const resp = await fetch(`${API_BASE}/media/upload`, { method: 'POST', body: formData })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Upload failed' }))
    throw new Error(err.detail || `Upload failed (${resp.status})`)
  }
  const data = await resp.json()
  return { path: data.path, url: data.url }
}

// (renderMarkdown, escapeHtml, formatTimestamp, ChatBubble moved to ChatMessageBubble.tsx)

// Deterministic color
const AGENT_COLORS = [
  '#8b5cf6',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#10b981',
  '#6366f1',
  '#f97316',
  '#14b8a6',
  '#a855f7',
  '#3b82f6',
]
function getColor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]
}

// (ChatBubble moved to ChatMessageBubble.tsx — use <ChatMessageBubble variant="mobile" />)

// ── File Preview Bar ───────────────────────────────────────────

function FilePreviewBar({
  files,
  onRemove,
}: {
  files: PendingFile[]
  onRemove: (id: string) => void
}) {
  if (files.length === 0) return null
  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid var(--mobile-divider)',
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--mobile-surface2)',
      }}
    >
      {files.map((f) => (
        <div
          key={f.id}
          style={{
            position: 'relative',
            flexShrink: 0,
            width: 72,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {/* Thumbnail or icon */}
          {f.previewUrl ? (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--mobile-surface2)',
                border: f.error ? '2px solid #ef4444' : '1px solid var(--mobile-input-border)',
              }}
            >
              <img
                src={f.previewUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                background: 'var(--mobile-surface2)',
                border: f.error ? '2px solid #ef4444' : '1px solid var(--mobile-input-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
              }}
            >
              📄
            </div>
          )}
          {/* Upload progress overlay */}
          {f.uploading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 4,
                width: 64,
                height: 64,
                borderRadius: 10,
                background: 'var(--mobile-overlay-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              ⏳
            </div>
          )}
          {/* Remove button */}
          <button
            onClick={() => onRemove(f.id)}
            style={{
              position: 'absolute',
              top: -4,
              right: 0,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--mobile-surface)',
              border: '1px solid var(--mobile-input-border)',
              color: 'var(--mobile-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={12} />
          </button>
          {/* Filename */}
          <span
            style={{
              fontSize: 9,
              color: f.error ? '#fca5a5' : 'var(--mobile-text-muted)',
              maxWidth: 72,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}
          >
            {f.error || `${formatFileSize(f.file.size)}`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

interface MobileAgentChatProps {
  readonly sessionKey: string
  readonly agentName: string
  readonly agentIcon: string | null
  readonly agentColor: string | null
  readonly subagentSessions: CrewSession[]
  readonly onBack: () => void
  readonly onOpenSettings?: () => void
}

export function MobileAgentChat({
  // NOSONAR: complexity from React component with multiple state interactions
  sessionKey,
  agentName,
  agentIcon,
  agentColor,
  subagentSessions,
  onBack,
  onOpenSettings,
}: MobileAgentChatProps) {
  const accentColor = agentColor || getColor(sessionKey)
  const icon = agentIcon || agentName.charAt(0).toUpperCase()

  const {
    messages,
    isSending,
    streamingMessageId,
    error,
    sendMessage,
    loadOlderMessages,
    hasMore,
    isLoadingHistory,
  } = useStreamingChat(sessionKey)

  const [inputValue, setInputValue] = useState('')
  const [showTasks, setShowTasks] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)
  const prevStreamingIdRef = useRef<string | null>(null)

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

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200)
  }, [])

  // ── File handling ──

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: PendingFile[] = Array.from(files).map((file) => {
      const tooLarge = file.size > MAX_FILE_SIZE
      const previewUrl = isImageFile(file) ? URL.createObjectURL(file) : null
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
        uploading: false,
        progress: 0,
        error: tooLarge ? 'Too large' : null,
        uploadedPath: null,
      }
    })
    setPendingFiles((prev) => [...prev, ...newFiles])
  }, [])

  const removeFile = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const file = prev.find((f) => f.id === id)
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
      return prev.filter((f) => f.id !== id)
    })
  }, [])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files)
        e.target.value = '' // reset so same file can be selected again
      }
    },
    [addFiles]
  )

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return
      const imageFiles: File[] = []
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile()
          if (file) imageFiles.push(file)
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault()
        addFiles(imageFiles)
      }
    },
    [addFiles]
  )

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    const filesToUpload = pendingFiles.filter((f) => !f.error)
    if ((!text && filesToUpload.length === 0) || isSending || isUploading) return

    setInputValue('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    // Upload files first
    let mediaPaths: string[] = []
    if (filesToUpload.length > 0) {
      setIsUploading(true)
      setPendingFiles((prev) => prev.map((f) => (f.error ? f : { ...f, uploading: true })))

      try {
        const results = await Promise.all(
          filesToUpload.map(async (pf) => {
            try {
              const result = await uploadFile(pf.file)
              return { id: pf.id, path: result.path, error: null }
            } catch (err: any) {
              return { id: pf.id, path: null, error: err.message }
            }
          })
        )

        const errors = results.filter((r) => r.error)
        if (errors.length > 0) {
          setPendingFiles((prev) =>
            prev.map((f) => {
              const result = results.find((r) => r.id === f.id)
              if (result?.error) return { ...f, uploading: false, error: result.error }
              return { ...f, uploading: false }
            })
          )
          setIsUploading(false)
          return // Don't send if uploads failed
        }

        mediaPaths = results.filter((r) => r.path).map((r) => r.path!)
      } catch {
        setIsUploading(false)
        return
      }
      setIsUploading(false)
    }

    // Clear pending files
    pendingFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
    })
    setPendingFiles([])

    // Build message with media references
    const parts: string[] = []
    if (text) parts.push(text)
    for (const path of mediaPaths) {
      parts.push(`MEDIA: ${path}`)
    }
    const fullMessage = parts.join('\n')
    if (fullMessage) sendMessage(fullMessage)
  }, [inputValue, pendingFiles, isSending, isUploading, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── Voice recording ────────────────────────────────────────────
  const handleAudioReady = useCallback(
    (url: string, duration: number, transcript: string | null, transcriptError: string | null) => {
      let msg = `[audio attached: ${url} (audio/webm) ${duration}s]`
      if (transcript) {
        msg += `\nTranscript: "${transcript}"`
      } else if (transcriptError) {
        msg += `\n[Voice transcription unavailable: ${transcriptError}]`
      }
      sendMessage(msg)
    },
    [sendMessage]
  )

  const {
    isRecording,
    isPreparing: micPreparing,
    duration: recDuration,
    error: recError,
    isSupported: micSupported,
    startRecording,
    stopAndSend,
    cancelRecording,
  } = useVoiceRecorder(handleAudioReady)

  // Swipe-to-cancel (mobile): touch move left >= 80px cancels
  const touchStartXRef = useRef<number | null>(null)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isRecording) touchStartXRef.current = e.touches[0].clientX
    },
    [isRecording]
  )
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isRecording || touchStartXRef.current === null) return
      const dx = touchStartXRef.current - e.touches[0].clientX
      if (dx > 80) {
        touchStartXRef.current = null
        cancelRecording()
      }
    },
    [isRecording, cancelRecording]
  )

  // Derive bot config, status, and animation for 3D avatar
  const botConfig = getBotConfigFromSession(sessionKey, agentName, agentColor)
  const agentStatus: AgentStatus = isSending ? 'active' : 'idle'
  const avatarAnimation: AvatarAnimation = agentStatus === 'active' ? 'thinking' : 'idle'

  return (
    <>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 12px 8px 8px',
          borderBottom: '1px solid var(--mobile-divider)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: 'transparent',
            color: 'var(--mobile-text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={20} />
        </button>

        {/* 3D character preview */}
        <ChatHeader3DAvatar
          config={botConfig}
          agentStatus={agentStatus}
          animation={avatarAnimation}
          icon={icon}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--mobile-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {agentName}
          </div>
          <div
            style={{ fontSize: 11, color: isSending ? accentColor : 'var(--mobile-text-muted)' }}
          >
            {isSending ? 'Thinking…' : 'Online'}
          </div>
        </div>

        <ActiveTasksBadge count={subagentSessions.length} onClick={() => setShowTasks(true)} />
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Settings"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              border: 'none',
              background: 'transparent',
              color: 'var(--mobile-text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <SettingsIcon size={17} />
          </button>
        )}
      </header>

      {/* Active Tasks Overlay */}
      {showTasks && (
        <ActiveTasksOverlay sessions={subagentSessions} onClose={() => setShowTasks(false)} />
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '12px 14px',
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
              padding: '6px 14px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--mobile-msg-assistant-bg)',
              color: 'var(--mobile-text-muted)',
              cursor: isLoadingHistory ? 'wait' : 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {isLoadingHistory ? 'Loading…' : '↑ Load older'}
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
              color: 'var(--mobile-text-muted)',
              fontSize: 14,
              padding: '40px 0',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 40 }}>💬</span>
            <span>Say hello to {agentName}!</span>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} msg={msg} variant="mobile" accentColor={accentColor} />
        ))}

        {isSending && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 0',
              color: 'var(--mobile-text-muted)',
              fontSize: 12,
            }}
          >
            <span style={{ animation: 'pulse 1.5s infinite' }}>●</span>
            {agentName} is thinking…
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#fca5a5',
              fontSize: 12,
              alignSelf: 'center',
            }}
          >
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* File Preview Bar */}
      <FilePreviewBar files={pendingFiles} onRemove={removeFile} />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.doc,.docx"
        multiple
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />

      {/* Input */}
      <div
        style={{
          padding: '10px 12px calc(env(safe-area-inset-bottom, 8px) + 10px)',
          borderTop: pendingFiles.length > 0 ? 'none' : '1px solid var(--mobile-divider)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: 'var(--mobile-bg, #0f172a)',
        }}
      >
        {/* Recording indicator bar (WhatsApp-style) */}
        {isRecording && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 4px 0',
              fontSize: 13,
              color: '#ef4444',
              fontFamily: 'monospace',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
          >
            <span style={{ animation: 'mob-rec-blink 0.6s step-end infinite' }}>●</span>
            {formatDuration(recDuration)}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--mobile-text-muted)', opacity: 0.7 }}>
              ← swipe to cancel
            </span>
          </div>
        )}
        {recError && (
          <div style={{ fontSize: 11, color: '#ef4444', paddingLeft: 4 }}>{recError}</div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* Attach button — hide while recording */}
          {!isRecording && (
            <button
              onClick={handleFileSelect}
              disabled={isSending || isUploading}
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                border: 'none',
                background:
                  pendingFiles.length > 0 ? accentColor + '20' : 'var(--mobile-attach-btn-bg)',
                color: pendingFiles.length > 0 ? accentColor : 'var(--mobile-text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <Paperclip size={20} />
            </button>
          )}

          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={isRecording ? 'Recording…' : `Message ${agentName}…`}
            disabled={isSending || isUploading || isRecording}
            rows={1}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 14,
              border: '1px solid var(--mobile-input-border)',
              background: 'var(--mobile-input-bg)',
              color: 'var(--mobile-text)',
              fontSize: 16,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              resize: 'none',
              outline: 'none',
              maxHeight: 100,
              lineHeight: 1.4,
            }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 100) + 'px'
            }}
          />

          {/* While recording: green send ↑ + ✕ cancel */}
          {isRecording && (
            <>
              <button
                onClick={stopAndSend}
                title="Stop & send voice message"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: 'none',
                  background: '#22c55e',
                  color: '#fff',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <ArrowUp size={20} />
              </button>
              <button
                onClick={cancelRecording}
                title="Cancel recording"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  border: 'none',
                  background: 'var(--mobile-attach-btn-bg)',
                  color: 'var(--mobile-text-secondary)',
                  cursor: 'pointer',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background 0.15s',
                }}
              >
                <X size={18} />
              </button>
            </>
          )}

          {/* While not recording: mic + send */}
          {!isRecording && (
            <>
              {micSupported && (
                <button
                  onClick={startRecording}
                  disabled={micPreparing || isSending || isUploading}
                  title="Voice message"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    border: 'none',
                    background: 'var(--mobile-attach-btn-bg)',
                    color: 'var(--mobile-text-secondary)',
                    cursor: micPreparing || isSending || isUploading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {micPreparing ? '⏳' : <Mic size={20} />}
                </button>
              )}

              {/* Send button — only show when there's text or files */}
              {(inputValue.trim() || pendingFiles.filter((f) => !f.error).length > 0) && (
                <button
                  onClick={handleSend}
                  disabled={
                    isSending ||
                    isUploading ||
                    (!inputValue.trim() && pendingFiles.filter((f) => !f.error).length === 0)
                  }
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    border: 'none',
                    background:
                      isSending ||
                      isUploading ||
                      (!inputValue.trim() && pendingFiles.filter((f) => !f.error).length === 0)
                        ? 'var(--mobile-msg-assistant-bg)'
                        : accentColor,
                    color:
                      isSending ||
                      isUploading ||
                      (!inputValue.trim() && pendingFiles.filter((f) => !f.error).length === 0)
                        ? 'var(--mobile-text-muted)'
                        : '#fff',
                    cursor:
                      isSending ||
                      isUploading ||
                      (!inputValue.trim() && pendingFiles.filter((f) => !f.error).length === 0)
                        ? 'default'
                        : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  {isUploading ? '⏳' : '➤'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes mob-rec-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </>
  )
}

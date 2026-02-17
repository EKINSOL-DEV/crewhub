import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type CSSProperties, type ClipboardEvent } from 'react'
import { ArrowLeft, Paperclip, X } from 'lucide-react'
import { useAgentChat, type ChatMessageData } from '@/hooks/useAgentChat'
import { parseMediaAttachments } from '@/utils/mediaParser'
import { ImageThumbnail } from '@/components/chat/ImageThumbnail'
import { API_BASE } from '@/lib/api'
import type { CrewSession } from '@/lib/api'
import { ActiveTasksBadge, ActiveTasksOverlay } from './ActiveTasksOverlay'
import { AgentCameraButton, AgentCameraOverlay, type AgentStatus } from './AgentCameraView'
import { getBotConfigFromSession } from '@/components/world3d/utils/botVariants'
import { ChatHeader3DAvatar } from './ChatHeader3DAvatar'

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
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

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

// ── File Preview Bar ───────────────────────────────────────────

function FilePreviewBar({ files, onRemove }: { files: PendingFile[]; onRemove: (id: string) => void }) {
  if (files.length === 0) return null
  return (
    <div style={{
      padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', gap: 8, overflowX: 'auto', WebkitOverflowScrolling: 'touch',
      background: 'rgba(255,255,255,0.02)',
    }}>
      {files.map(f => (
        <div key={f.id} style={{
          position: 'relative', flexShrink: 0,
          width: 72, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }}>
          {/* Thumbnail or icon */}
          {f.previewUrl ? (
            <div style={{
              width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
              background: 'rgba(255,255,255,0.05)',
              border: f.error ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
            }}>
              <img src={f.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: f.error ? '2px solid #ef4444' : '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24,
            }}>
              📄
            </div>
          )}
          {/* Upload progress overlay */}
          {f.uploading && (
            <div style={{
              position: 'absolute', top: 0, left: 4, width: 64, height: 64, borderRadius: 10,
              background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 11, fontWeight: 600,
            }}>
              ⏳
            </div>
          )}
          {/* Remove button */}
          <button
            onClick={() => onRemove(f.id)}
            style={{
              position: 'absolute', top: -4, right: 0,
              width: 22, height: 22, borderRadius: '50%',
              background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)',
              color: '#94a3b8', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={12} />
          </button>
          {/* Filename */}
          <span style={{
            fontSize: 9, color: f.error ? '#fca5a5' : '#64748b',
            maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textAlign: 'center',
          }}>
            {f.error || `${formatFileSize(f.file.size)}`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Agent Status Derivation ────────────────────────────────────

function deriveAgentStatus(isSending: boolean, subagentSessions: CrewSession[]): AgentStatus {
  if (isSending) return 'active'
  const hasActiveSubagent = subagentSessions.some(s => (Date.now() - s.updatedAt) < 300_000)
  if (hasActiveSubagent) return 'active'
  return 'idle'
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
  const [showTasks, setShowTasks] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  // ── File handling ──

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: PendingFile[] = Array.from(files).map(file => {
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
    setPendingFiles(prev => [...prev, ...newFiles])
  }, [])

  const removeFile = useCallback((id: string) => {
    setPendingFiles(prev => {
      const file = prev.find(f => f.id === id)
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
      return prev.filter(f => f.id !== id)
    })
  }, [])

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files)
      e.target.value = '' // reset so same file can be selected again
    }
  }, [addFiles])

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
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
  }, [addFiles])

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    const filesToUpload = pendingFiles.filter(f => !f.error)
    if ((!text && filesToUpload.length === 0) || isSending || isUploading) return

    setInputValue('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    // Upload files first
    let mediaPaths: string[] = []
    if (filesToUpload.length > 0) {
      setIsUploading(true)
      setPendingFiles(prev => prev.map(f => f.error ? f : { ...f, uploading: true }))

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

        const errors = results.filter(r => r.error)
        if (errors.length > 0) {
          setPendingFiles(prev => prev.map(f => {
            const result = results.find(r => r.id === f.id)
            if (result?.error) return { ...f, uploading: false, error: result.error }
            return { ...f, uploading: false }
          }))
          setIsUploading(false)
          return // Don't send if uploads failed
        }

        mediaPaths = results.filter(r => r.path).map(r => r.path!)
      } catch {
        setIsUploading(false)
        return
      }
      setIsUploading(false)
    }

    // Clear pending files
    pendingFiles.forEach(f => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl) })
    setPendingFiles([])

    // Build message with media references
    const parts: string[] = []
    if (text) parts.push(text)
    for (const path of mediaPaths) {
      parts.push(`MEDIA: ${path}`)
    }
    const fullMessage = parts.join('\n')
    if (fullMessage) await sendMessage(fullMessage)
  }, [inputValue, pendingFiles, isSending, isUploading, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Derive bot config + status for 3D avatar
  const botConfig = getBotConfigFromSession(sessionKey, agentName, agentColor)
  const agentStatus: AgentStatus = isSending ? 'active' : 'idle'

  return (
    <>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px 8px 8px',
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
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={20} />
        </button>

        {/* 3D character preview */}
        <ChatHeader3DAvatar
          config={botConfig}
          agentStatus={agentStatus}
          icon={icon}
        />

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

        <AgentCameraButton onClick={() => setShowCamera(v => !v)} isActive={showCamera} />
        <ActiveTasksBadge
          count={subagentSessions.length}
          onClick={() => setShowTasks(true)}
        />
      </header>

      {/* Active Tasks Overlay */}
      {showTasks && (
        <ActiveTasksOverlay
          sessions={subagentSessions}
          onClose={() => setShowTasks(false)}
        />
      )}

      {/* 3D Camera Overlay */}
      <AgentCameraOverlay
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        agentName={agentName}
        agentStatus={deriveAgentStatus(isSending, subagentSessions)}
        botConfig={botConfig}
      />

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
      <div style={{
        padding: '10px 12px calc(env(safe-area-inset-bottom, 8px) + 10px)',
        borderTop: pendingFiles.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
        display: 'flex', gap: 8, alignItems: 'flex-end',
        background: '#0f172a',
      }}>
        {/* Attach button */}
        <button
          onClick={handleFileSelect}
          disabled={isSending || isUploading}
          style={{
            width: 44, height: 44, borderRadius: 14,
            border: 'none',
            background: pendingFiles.length > 0 ? accentColor + '20' : 'rgba(255,255,255,0.05)',
            color: pendingFiles.length > 0 ? accentColor : '#64748b',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.15s',
          }}
        >
          <Paperclip size={20} />
        </button>

        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={`Message ${agentName}…`}
          disabled={isSending || isUploading}
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
          disabled={(isSending || isUploading) || (!inputValue.trim() && pendingFiles.filter(f => !f.error).length === 0)}
          style={{
            width: 44, height: 44, borderRadius: 14,
            border: 'none',
            background: (isSending || isUploading) || (!inputValue.trim() && pendingFiles.filter(f => !f.error).length === 0)
              ? 'rgba(255,255,255,0.06)' : accentColor,
            color: (isSending || isUploading) || (!inputValue.trim() && pendingFiles.filter(f => !f.error).length === 0)
              ? '#475569' : '#fff',
            cursor: (isSending || isUploading) || (!inputValue.trim() && pendingFiles.filter(f => !f.error).length === 0)
              ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {isUploading ? '⏳' : '➤'}
        </button>
      </div>
    </>
  )
}

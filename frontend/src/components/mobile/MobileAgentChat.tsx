/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ComponentProps,
  type RefObject,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react'
import type React from 'react'
import { ArrowLeft, ArrowUp, Paperclip, X, Settings as SettingsIcon, Mic } from 'lucide-react'
import { useStreamingChat } from '@/hooks/useStreamingChat'
import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { useVoiceRecorder, formatDuration } from '@/hooks/useVoiceRecorder'
import { API_BASE } from '@/lib/api'
import type { CrewSession } from '@/lib/api'
import { sseManager } from '@/lib/sseManager'
import { ActiveTasksBadge, ActiveTasksOverlay } from './ActiveTasksOverlay'
import { type AgentStatus } from './AgentCameraView'
import { getBotConfigFromSession } from '@/components/world3d/utils/botVariants'
import { formatFileSize } from '@/lib/formatters'
import { ChatHeader3DAvatar, type AvatarAnimation } from './ChatHeader3DAvatar'

const BORDER_1PX_SOLID_VAR_MOBILE_DIVIDER = '1px solid var(--mobile-divider)'
const BORDER_1PX_SOLID_VAR_MOBILE_INPUT_BOR = '1px solid var(--mobile-input-border)'
const CLS_BACKGROUND_015S = 'background 0.15s'
const VAR_MOBILE_ATTACH_BTN_BG = 'var(--mobile-attach-btn-bg)'
const VAR_MOBILE_SURFACE2 = 'var(--mobile-surface2)'
const VAR_MOBILE_TEXT_MUTED = 'var(--mobile-text-muted)'
const VAR_MOBILE_TEXT_SECONDARY = 'var(--mobile-text-secondary)'

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

function mapUploadResult(results: { id: string; error: string | null }[]) {
  return (f: PendingFile): PendingFile => {
    const result = results.find((r) => r.id === f.id)
    if (result?.error) return { ...f, uploading: false, error: result.error }
    return { ...f, uploading: false }
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function isImageFile(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.has(file.type)
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

function createPendingFile(file: File): PendingFile {
  const tooLarge = file.size > MAX_FILE_SIZE
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    previewUrl: isImageFile(file) ? URL.createObjectURL(file) : null,
    uploading: false,
    progress: 0,
    error: tooLarge ? 'Too large' : null,
    uploadedPath: null,
  }
}

function getPastedImages(items: DataTransferItemList | undefined): File[] {
  if (!items) return []
  const imageFiles: File[] = []
  for (const item of items) {
    if (!item.type.startsWith('image/')) continue
    const file = item.getAsFile()
    if (file) imageFiles.push(file)
  }
  return imageFiles
}

async function uploadPendingFiles(filesToUpload: PendingFile[]) {
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
  const mediaPaths = results.filter((r) => r.path).map((r) => r.path as string)
  return { results, errors, mediaPaths }
}

function buildMessagePayload(text: string, mediaPaths: string[]) {
  const parts: string[] = []
  if (text) parts.push(text)
  for (const path of mediaPaths) {
    parts.push(`MEDIA: ${path}`)
  }
  return parts.join('\n')
}

function updateNearBottomFlag(
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  isNearBottomRef: React.MutableRefObject<boolean>
) {
  const container = scrollContainerRef.current
  if (!container) return
  isNearBottomRef.current =
    container.scrollHeight - container.scrollTop - container.clientHeight < 80
}

function syncScrollOnMessageGrowth(
  messageCount: number,
  prevMessageCountRef: React.MutableRefObject<number>,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  messagesEndRef: React.RefObject<HTMLDivElement | null>,
  isNearBottomRef: React.MutableRefObject<boolean>
) {
  if (messageCount > prevMessageCountRef.current) {
    if (prevMessageCountRef.current === 0) {
      const container = scrollContainerRef.current
      if (container) container.scrollTop = container.scrollHeight
    } else if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  prevMessageCountRef.current = messageCount
}

function syncScrollOnStreaming(
  streamingMessageId: string | null,
  prevStreamingIdRef: React.MutableRefObject<string | null>,
  messagesEndRef: React.RefObject<HTMLDivElement | null>,
  isNearBottomRef: React.MutableRefObject<boolean>
) {
  const wasStreaming = prevStreamingIdRef.current !== null
  const isStreaming = streamingMessageId !== null

  if (isStreaming && isNearBottomRef.current) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  } else if (wasStreaming && !isStreaming) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    isNearBottomRef.current = true
  }

  prevStreamingIdRef.current = streamingMessageId
}

function applySelectedFiles(
  e: React.ChangeEvent<HTMLInputElement>,
  addFiles: (files: FileList) => void
) {
  if (!e.target.files || e.target.files.length === 0) return
  addFiles(e.target.files)
  e.target.value = ''
}

function applyPastedImages(
  e: ClipboardEvent<HTMLTextAreaElement>,
  addFiles: (files: File[]) => void
) {
  const imageFiles = getPastedImages(e.clipboardData?.items)
  if (imageFiles.length === 0) return
  e.preventDefault()
  addFiles(imageFiles)
}

function submitOnEnter(e: KeyboardEvent<HTMLTextAreaElement>, onSend: () => void) {
  if (e.key !== 'Enter' || e.shiftKey) return
  e.preventDefault()
  onSend()
}

async function uploadFilesForSend(
  filesToUpload: PendingFile[],
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>,
  setPendingFiles: React.Dispatch<React.SetStateAction<PendingFile[]>>
): Promise<{ aborted: boolean; mediaPaths: string[] }> {
  if (filesToUpload.length === 0) return { aborted: false, mediaPaths: [] }

  setIsUploading(true)
  setPendingFiles((prev) => prev.map((f) => (f.error ? f : { ...f, uploading: true })))

  try {
    const { results, errors, mediaPaths } = await uploadPendingFiles(filesToUpload)
    if (errors.length > 0) {
      setPendingFiles((prev) => prev.map(mapUploadResult(results)))
      return { aborted: true, mediaPaths: [] }
    }
    return { aborted: false, mediaPaths }
  } catch {
    return { aborted: true, mediaPaths: [] }
  } finally {
    setIsUploading(false)
  }
}

function revokePendingPreviewUrls(pendingFiles: PendingFile[]) {
  pendingFiles.forEach((file) => {
    if (file.previewUrl) URL.revokeObjectURL(file.previewUrl)
  })
}

function buildVoiceAttachmentMessage(
  url: string,
  duration: number,
  transcript: string | null,
  transcriptError: string | null
): string {
  const message = `[audio attached: ${url} (audio/webm) ${duration}s]`
  if (transcript) return `${message}\nTranscript: "${transcript}"`
  if (transcriptError) return `${message}\n[Voice transcription unavailable: ${transcriptError}]`
  return message
}

function updateTouchStartX(
  e: React.TouchEvent,
  isRecording: boolean,
  touchStartXRef: React.MutableRefObject<number | null>
) {
  if (isRecording) touchStartXRef.current = e.touches[0].clientX
}

function handleRecordingSwipeCancel(
  e: React.TouchEvent,
  isRecording: boolean,
  touchStartXRef: React.MutableRefObject<number | null>,
  cancelRecording: () => void
) {
  if (!isRecording || touchStartXRef.current === null) return
  const deltaX = touchStartXRef.current - e.touches[0].clientX
  if (deltaX <= 80) return
  touchStartXRef.current = null
  cancelRecording()
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
  for (let i = 0; i < key.length; i++) hash = Math.trunc(hash * 31 + (key.codePointAt(i) ?? 0))
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length]
}

// (ChatBubble moved to ChatMessageBubble.tsx — use <ChatMessageBubble variant="mobile" />)

// ── File Preview Bar ───────────────────────────────────────────

function FilePreviewBar({
  files,
  onRemove,
}: {
  readonly files: PendingFile[]
  readonly onRemove: (id: string) => void
}) {
  if (files.length === 0) return null
  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: BORDER_1PX_SOLID_VAR_MOBILE_DIVIDER,
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: VAR_MOBILE_SURFACE2,
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
                background: VAR_MOBILE_SURFACE2,
                border: f.error ? '2px solid #ef4444' : BORDER_1PX_SOLID_VAR_MOBILE_INPUT_BOR,
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
                background: VAR_MOBILE_SURFACE2,
                border: f.error ? '2px solid #ef4444' : BORDER_1PX_SOLID_VAR_MOBILE_INPUT_BOR,
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
              border: BORDER_1PX_SOLID_VAR_MOBILE_INPUT_BOR,
              color: VAR_MOBILE_TEXT_SECONDARY,
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
              color: f.error ? '#fca5a5' : VAR_MOBILE_TEXT_MUTED,
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

// ── Sub-components ─────────────────────────────────────────────

interface ChatHeaderProps {
  readonly onBack: () => void
  readonly botConfig: ReturnType<typeof getBotConfigFromSession>
  readonly agentStatus: AgentStatus
  readonly avatarAnimation: AvatarAnimation
  readonly icon: string
  readonly agentName: string
  readonly isSending: boolean
  readonly accentColor: string
  readonly subagentSessions: CrewSession[]
  readonly onOpenSettings?: () => void
  readonly onShowTasks: () => void
  readonly activityDetail?: string | null
}

function ChatHeader({
  onBack,
  botConfig,
  agentStatus,
  avatarAnimation,
  icon,
  agentName,
  isSending,
  accentColor,
  subagentSessions,
  onOpenSettings,
  onShowTasks,
  activityDetail,
}: ChatHeaderProps) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px 8px 8px',
        borderBottom: BORDER_1PX_SOLID_VAR_MOBILE_DIVIDER,
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
          color: VAR_MOBILE_TEXT_SECONDARY,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <ArrowLeft size={20} />
      </button>
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
        <div style={{ fontSize: 11, color: isSending ? accentColor : VAR_MOBILE_TEXT_MUTED }}>
          {isSending
            ? (activityDetail || 'Thinking…')
            : 'Online'}
        </div>
      </div>
      <ActiveTasksBadge count={subagentSessions.length} onClick={onShowTasks} />
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
            color: VAR_MOBILE_TEXT_SECONDARY,
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
  )
}

type ChatMsg = ComponentProps<typeof ChatMessageBubble>['msg']

interface ChatMessagesListProps {
  readonly scrollContainerRef: RefObject<HTMLDivElement | null>
  readonly messagesEndRef: RefObject<HTMLDivElement | null>
  readonly onScroll: () => void
  readonly hasMore: boolean
  readonly isLoadingHistory: boolean
  readonly onLoadOlder: () => void
  readonly messages: readonly ChatMsg[]
  readonly isSending: boolean
  readonly error: string | null
  readonly agentName: string
  readonly accentColor: string
}

function ChatMessagesList({
  scrollContainerRef,
  messagesEndRef,
  onScroll,
  hasMore,
  isLoadingHistory,
  onLoadOlder,
  messages,
  isSending,
  error,
  agentName,
  accentColor,
}: ChatMessagesListProps) {
  return (
    <div
      ref={scrollContainerRef}
      onScroll={onScroll}
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
          onClick={onLoadOlder}
          disabled={isLoadingHistory}
          style={{
            alignSelf: 'center',
            padding: '6px 14px',
            borderRadius: 10,
            border: 'none',
            background: 'var(--mobile-msg-assistant-bg)',
            color: VAR_MOBILE_TEXT_MUTED,
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
            color: VAR_MOBILE_TEXT_MUTED,
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
            color: VAR_MOBILE_TEXT_MUTED,
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
  )
}

interface ChatInputAreaProps {
  readonly inputRef: RefObject<HTMLTextAreaElement | null>
  readonly isRecording: boolean
  readonly recDuration: number
  readonly recError: string | null | undefined
  readonly onTouchStart: (e: React.TouchEvent) => void
  readonly onTouchMove: (e: React.TouchEvent) => void
  readonly pendingFiles: readonly PendingFile[]
  readonly isSending: boolean
  readonly isUploading: boolean
  readonly onFileSelect: () => void
  readonly inputValue: string
  readonly onInputChange: (value: string) => void
  readonly onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
  readonly onPaste: (e: ClipboardEvent<HTMLTextAreaElement>) => void
  readonly agentName: string
  readonly onStopAndSend: () => void
  readonly onCancelRecording: () => void
  readonly micSupported: boolean
  readonly micPreparing: boolean
  readonly onStartRecording: () => void
  readonly hasPendingFiles: boolean
  readonly onSend: () => void
  readonly accentColor: string
}

interface VoiceControlButtonsProps {
  readonly isRecording: boolean
  readonly isSending: boolean
  readonly isUploading: boolean
  readonly isSendDisabled: boolean
  readonly sendBtnBg: string
  readonly sendBtnColor: string
  readonly sendBtnCursor: string
  readonly micSupported: boolean
  readonly micPreparing: boolean
  readonly inputValue: string
  readonly hasPendingFiles: boolean
  readonly onStopAndSend: () => void
  readonly onCancelRecording: () => void
  readonly onStartRecording: () => void
  readonly onSend: () => void
}

function VoiceControlButtons({
  isRecording,
  isSending,
  isUploading,
  isSendDisabled,
  sendBtnBg,
  sendBtnColor,
  sendBtnCursor,
  micSupported,
  micPreparing,
  inputValue,
  hasPendingFiles,
  onStopAndSend,
  onCancelRecording,
  onStartRecording,
  onSend,
}: VoiceControlButtonsProps) {
  if (isRecording) {
    return (
      <>
        <button
          onClick={onStopAndSend}
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
            transition: CLS_BACKGROUND_015S,
          }}
        >
          <ArrowUp size={20} />
        </button>
        <button
          onClick={onCancelRecording}
          title="Cancel recording"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            border: 'none',
            background: VAR_MOBILE_ATTACH_BTN_BG,
            color: VAR_MOBILE_TEXT_SECONDARY,
            cursor: 'pointer',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: CLS_BACKGROUND_015S,
          }}
        >
          <X size={18} />
        </button>
      </>
    )
  }
  const micDisabled = micPreparing || isSending || isUploading
  return (
    <>
      {micSupported && (
        <button
          onClick={onStartRecording}
          disabled={micDisabled}
          title="Voice message"
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            border: 'none',
            background: VAR_MOBILE_ATTACH_BTN_BG,
            color: VAR_MOBILE_TEXT_SECONDARY,
            cursor: micDisabled ? 'default' : 'pointer',
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
      {(inputValue.trim() || hasPendingFiles) && (
        <button
          onClick={onSend}
          disabled={isSendDisabled}
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            border: 'none',
            background: sendBtnBg,
            color: sendBtnColor,
            cursor: sendBtnCursor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
            transition: CLS_BACKGROUND_015S,
          }}
        >
          {isSending ? '⏳' : '➤'}
        </button>
      )}
    </>
  )
}

function ChatInputArea({
  inputRef,
  isRecording,
  recDuration,
  recError,
  onTouchStart,
  onTouchMove,
  pendingFiles,
  isSending,
  isUploading,
  onFileSelect,
  inputValue,
  onInputChange,
  onKeyDown,
  onPaste,
  agentName,
  onStopAndSend,
  onCancelRecording,
  micSupported,
  micPreparing,
  onStartRecording,
  hasPendingFiles,
  onSend,
  accentColor,
}: ChatInputAreaProps) {
  const isSendDisabled = isSending || isUploading || (!inputValue.trim() && !hasPendingFiles)
  const sendBtnBg = isSendDisabled ? 'var(--mobile-msg-assistant-bg)' : accentColor
  const sendBtnColor = isSendDisabled ? VAR_MOBILE_TEXT_MUTED : '#fff'
  const sendBtnCursor = isSendDisabled ? 'default' : 'pointer'
  const borderTop = pendingFiles.length > 0 ? 'none' : BORDER_1PX_SOLID_VAR_MOBILE_DIVIDER
  const attachBg = pendingFiles.length > 0 ? accentColor + '20' : VAR_MOBILE_ATTACH_BTN_BG
  const attachColor = pendingFiles.length > 0 ? accentColor : VAR_MOBILE_TEXT_SECONDARY

  return (
    <div
      style={{
        padding: '10px 12px calc(env(safe-area-inset-bottom, 8px) + 10px)',
        borderTop,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'var(--mobile-bg, #0f172a)',
      }}
    >
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
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
        >
          <span style={{ animation: 'mob-rec-blink 0.6s step-end infinite' }}>●</span>
          {formatDuration(recDuration)}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: VAR_MOBILE_TEXT_MUTED, opacity: 0.7 }}>
            ← swipe to cancel
          </span>
        </div>
      )}
      {recError && <div style={{ fontSize: 11, color: '#ef4444', paddingLeft: 4 }}>{recError}</div>}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        {!isRecording && (
          <button
            onClick={onFileSelect}
            disabled={isSending || isUploading}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              border: 'none',
              background: attachBg,
              color: attachColor,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: CLS_BACKGROUND_015S,
            }}
          >
            <Paperclip size={20} />
          </button>
        )}
        <textarea
          ref={inputRef}
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={isRecording ? 'Recording…' : `Message ${agentName}…`}
          disabled={isSending || isUploading || isRecording}
          rows={1}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 14,
            border: BORDER_1PX_SOLID_VAR_MOBILE_INPUT_BOR,
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
        <VoiceControlButtons
          isRecording={isRecording}
          isSending={isSending}
          isUploading={isUploading}
          isSendDisabled={isSendDisabled}
          sendBtnBg={sendBtnBg}
          sendBtnColor={sendBtnColor}
          sendBtnCursor={sendBtnCursor}
          micSupported={micSupported}
          micPreparing={micPreparing}
          inputValue={inputValue}
          hasPendingFiles={hasPendingFiles}
          onStopAndSend={onStopAndSend}
          onCancelRecording={onCancelRecording}
          onStartRecording={onStartRecording}
          onSend={onSend}
        />
      </div>
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
  const [activityDetail, setActivityDetail] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCount = useRef(0)
  const prevStreamingIdRef = useRef<string | null>(null)

  const handleScroll = useCallback(() => {
    updateNearBottomFlag(scrollContainerRef, isNearBottomRef)
  }, [])

  useEffect(() => {
    syncScrollOnMessageGrowth(
      messages.length,
      prevMessageCount,
      scrollContainerRef,
      messagesEndRef,
      isNearBottomRef
    )
  }, [messages.length])

  useEffect(() => {
    syncScrollOnStreaming(streamingMessageId, prevStreamingIdRef, messagesEndRef, isNearBottomRef)
  }, [messages, streamingMessageId])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 200)
  }, [])

  // Track CC activity detail from SSE events
  useEffect(() => {
    const handleUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.source === 'claude_code' && data.sessionKey === sessionKey) {
          setActivityDetail(data.activity_detail || null)
        }
      } catch {
        // ignore
      }
    }
    const unsub = sseManager.subscribe('session-updated', handleUpdate)
    return () => unsub()
  }, [sessionKey])

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles = Array.from(files).map(createPendingFile)
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
      applySelectedFiles(e, addFiles)
    },
    [addFiles]
  )

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      applyPastedImages(e, addFiles)
    },
    [addFiles]
  )

  const pendingFilesRef = useRef<PendingFile[]>(pendingFiles)
  pendingFilesRef.current = pendingFiles
  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
      })
    }
  }, [])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    const filesToUpload = pendingFiles.filter((f) => !f.error)
    if ((!text && filesToUpload.length === 0) || isSending || isUploading) return
    setInputValue('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    const { aborted, mediaPaths } = await uploadFilesForSend(
      filesToUpload,
      setIsUploading,
      setPendingFiles
    )
    if (aborted) return
    revokePendingPreviewUrls(pendingFiles)
    setPendingFiles([])
    const fullMessage = buildMessagePayload(text, mediaPaths)
    if (fullMessage) sendMessage(fullMessage)
  }, [inputValue, pendingFiles, isSending, isUploading, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    submitOnEnter(e, handleSend)
  }

  const handleAudioReady = useCallback(
    (url: string, duration: number, transcript: string | null, transcriptError: string | null) => {
      sendMessage(buildVoiceAttachmentMessage(url, duration, transcript, transcriptError))
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

  const touchStartXRef = useRef<number | null>(null)
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      updateTouchStartX(e, isRecording, touchStartXRef)
    },
    [isRecording]
  )
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleRecordingSwipeCancel(e, isRecording, touchStartXRef, cancelRecording)
    },
    [isRecording, cancelRecording]
  )

  const botConfig = getBotConfigFromSession(sessionKey, agentName, agentColor)
  const agentStatus: AgentStatus = isSending ? 'active' : 'idle'
  const avatarAnimation: AvatarAnimation = agentStatus === 'active' ? 'thinking' : 'idle'
  const hasPendingFiles = pendingFiles.some((f) => !f.error)

  return (
    <>
      <ChatHeader
        onBack={onBack}
        botConfig={botConfig}
        agentStatus={agentStatus}
        avatarAnimation={avatarAnimation}
        icon={icon}
        agentName={agentName}
        isSending={isSending}
        accentColor={accentColor}
        subagentSessions={subagentSessions}
        onOpenSettings={onOpenSettings}
        onShowTasks={() => setShowTasks(true)}
        activityDetail={activityDetail}
      />
      {showTasks && (
        <ActiveTasksOverlay sessions={subagentSessions} onClose={() => setShowTasks(false)} />
      )}
      <ChatMessagesList
        scrollContainerRef={scrollContainerRef}
        messagesEndRef={messagesEndRef}
        onScroll={handleScroll}
        hasMore={hasMore}
        isLoadingHistory={isLoadingHistory}
        onLoadOlder={loadOlderMessages}
        messages={messages}
        isSending={isSending}
        error={error}
        agentName={agentName}
        accentColor={accentColor}
      />
      <FilePreviewBar files={pendingFiles} onRemove={removeFile} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.doc,.docx"
        multiple
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
      />
      <ChatInputArea
        inputRef={inputRef}
        isRecording={isRecording}
        recDuration={recDuration}
        recError={recError}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        pendingFiles={pendingFiles}
        isSending={isSending}
        isUploading={isUploading}
        onFileSelect={handleFileSelect}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        agentName={agentName}
        onStopAndSend={stopAndSend}
        onCancelRecording={cancelRecording}
        micSupported={micSupported}
        micPreparing={micPreparing}
        onStartRecording={startRecording}
        hasPendingFiles={hasPendingFiles}
        onSend={handleSend}
        accentColor={accentColor}
      />
      <style>{`
        @keyframes mob-rec-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </>
  )
}

/**
 * ChatMessageBubble — shared message renderer used by:
 *  - ZenChatPanel (variant="zen")
 *  - AgentChatWindow (variant="float")
 *  - MobileAgentChat (variant="mobile")
 *
 * Provides: full markdown rendering, thinking blocks,
 * tool call display, image/video attachments,
 * and OpenClaw reply-tag stripping.
 */

import { memo, useMemo, useState, type CSSProperties } from 'react'
import type { ChatMessageData, ToolCallData } from '@/hooks/useAgentChat'
import { parseMediaAttachments } from '@/utils/mediaParser'
import { stripOpenClawTags } from '@/lib/messageUtils'
import { ImageThumbnail } from './ImageThumbnail'
import { VideoThumbnail } from './VideoThumbnail'

// ─────────────────────────────────────────────────────────────────
// Markdown renderer (full-featured, shared for all variants)
// ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render markdown to HTML.
 * Supports: code blocks, inline code, headers, blockquotes, bold,
 * italic, strikethrough, links, ordered/unordered lists, hr.
 *
 * @param text - Raw markdown text
 * @param codeBlockStyle - Override style for <pre> blocks (used in light/dark variants)
 */
export function renderMarkdown(
  text: string,
  codeBlockStyle?: string,
  inlineCodeStyle?: string,
): string {
  let html = text

  // Code blocks (protect first)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, lang, code) => {
      const style = codeBlockStyle ?? ''
      return `<pre class="chat-md-codeblock" data-lang="${lang}"${style ? ` style="${style}"` : ''}><code>${escapeHtml(code.trim())}</code></pre>`
    },
  )

  // Inline code (protect from other replacements)
  const inlineCodePlaceholders: string[] = []
  html = html.replace(/`([^`]+)`/g, (_m, code) => {
    const style = inlineCodeStyle ?? ''
    const placeholder = `%%INLINE_CODE_${inlineCodePlaceholders.length}%%`
    inlineCodePlaceholders.push(
      `<code class="chat-md-inline-code"${style ? ` style="${style}"` : ''}>${escapeHtml(code)}</code>`,
    )
    return placeholder
  })

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 class="chat-md-h3">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="chat-md-h2">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 class="chat-md-h1">$1</h2>')

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote class="chat-md-blockquote">$1</blockquote>')

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="chat-md-hr" />')

  // Bold + italic combo (***text***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" class="chat-md-link">$1</a>',
  )

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li class="chat-md-li">$1</li>')
  html = html.replace(
    /(<li class="chat-md-li">.*<\/li>\n?)+/g,
    '<ul class="chat-md-ul">$&</ul>',
  )

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="chat-md-li-ordered">$1</li>')
  html = html.replace(
    /(<li class="chat-md-li-ordered">.*<\/li>\n?)+/g,
    '<ol class="chat-md-ol">$&</ol>',
  )

  // Restore inline code
  inlineCodePlaceholders.forEach((code, i) => {
    html = html.replace(`%%INLINE_CODE_${i}%%`, code)
  })

  // Line breaks (not inside block elements)
  html = html.replace(/\n/g, '<br/>')

  // Clean up extra breaks around block elements
  html = html.replace(/<\/(h[234]|blockquote|ul|ol|pre|hr)><br\/>/g, '</$1>')
  html = html.replace(/<br\/><(h[234]|blockquote|ul|ol|pre)/g, '<$1')

  return html
}

// ─────────────────────────────────────────────────────────────────
// Thinking Block (shared, configurable via inline styles / css)
// ─────────────────────────────────────────────────────────────────

interface ThinkingBlockProps {
  content: string
  /** If true, use Zen Mode CSS classes; otherwise use inline styles */
  zenMode?: boolean
}

export function ThinkingBlock({ content, zenMode }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isLong = content.length > 500

  if (zenMode) {
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
        <div
          className={`zen-thinking-block-content ${isExpanded ? 'zen-thinking-block-expanded' : ''}`}
        >
          {isExpanded || !isLong ? content : content.slice(0, 500) + '...'}
        </div>
      </div>
    )
  }

  // Inline-styles version (for float/mobile variants)
  const displayText = isExpanded ? content : content.slice(0, 200)
  return (
    <div
      style={{
        padding: '6px 10px',
        borderRadius: 8,
        fontSize: 11,
        background: 'rgba(147, 51, 234, 0.08)',
        border: '1px solid rgba(147, 51, 234, 0.15)',
        color: '#7c3aed',
        alignSelf: 'flex-start',
        maxWidth: '100%',
        fontStyle: 'italic',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <span>💭</span>
        <div style={{ flex: 1, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {displayText}
          {isLong && !isExpanded && '...'}
          {isLong && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                marginLeft: 6,
                padding: '1px 6px',
                borderRadius: 4,
                border: 'none',
                background: 'rgba(147, 51, 234, 0.15)',
                color: '#7c3aed',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              {isExpanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Tool Call Block (shared)
// ─────────────────────────────────────────────────────────────────

interface ToolCallBlockProps {
  tool: ToolCallData
  showDetails?: boolean
  zenMode?: boolean
}

export function ToolCallBlock({ tool, showDetails, zenMode }: ToolCallBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const isSuccess = tool.status === 'done' || tool.status === 'called'
  const hasDetails = showDetails && (tool.input || tool.result)

  if (zenMode) {
    return (
      <div className="zen-tool-call">
        <span className="zen-tool-icon">🔧</span>
        <span className="zen-tool-name">{tool.name}</span>
        <span
          className={`zen-tool-status ${isSuccess ? 'zen-tool-status-success' : 'zen-tool-status-error'}`}
        >
          {isSuccess ? '✓' : '✗'}
        </span>
      </div>
    )
  }

  // Inline-styles version
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        padding: '4px 8px',
        borderRadius: 6,
        fontSize: 11,
        background: 'rgba(251, 191, 36, 0.1)',
        border: '1px solid rgba(251, 191, 36, 0.2)',
        alignSelf: 'flex-start',
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontWeight: 500,
          color: '#b45309',
          cursor: hasDetails ? 'pointer' : 'default',
        }}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        🔧 {tool.name} {isSuccess ? '✓' : '✗'}
        {hasDetails && (
          <span style={{ fontSize: 10, marginLeft: 'auto' }}>
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </div>
      {expanded && tool.input && (
        <pre
          style={{
            margin: 0,
            padding: '4px 6px',
            borderRadius: 4,
            background: 'rgba(0,0,0,0.04)',
            fontSize: 10,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 100,
            overflow: 'auto',
            color: '#4b5563',
          }}
        >
          {JSON.stringify(tool.input, null, 2).slice(0, 500)}
        </pre>
      )}
      {expanded && tool.result && (
        <pre
          style={{
            margin: 0,
            padding: '4px 6px',
            borderRadius: 4,
            background: 'rgba(0,0,0,0.04)',
            fontSize: 10,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: 80,
            overflow: 'auto',
            color: '#6b7280',
          }}
        >
          → {tool.result}
        </pre>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// ChatMessageBubble — unified message renderer
// ─────────────────────────────────────────────────────────────────

export type ChatVariant = 'zen' | 'float' | 'mobile'

export interface ChatMessageBubbleProps {
  msg: ChatMessageData
  /**
   * Visual variant:
   * - "zen"    → Zen Mode CSS classes, terminal-like UI
   * - "float"  → Floating window (light bg)
   * - "mobile" → Mobile chat (dark bg)
   */
  variant?: ChatVariant
  accentColor?: string
  /** Show thinking blocks (LLM chain-of-thought) */
  showThinking?: boolean
  /** Show tool call input/result details */
  showToolDetails?: boolean
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

function formatTimestamp(ts: number): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const ChatMessageBubbleInner = memo(function ChatMessageBubble({
  msg,
  variant = 'float',
  accentColor = '#8b5cf6',
  showThinking = false,
  showToolDetails = false,
}: ChatMessageBubbleProps) {
  const isUser = msg.role === 'user'
  const isSystem = msg.role === 'system'

  // Parse media attachments
  const { text, attachments } = parseMediaAttachments(msg.content || '')
  const imageAttachments = attachments.filter(a => a.type === 'image')
  const videoAttachments = attachments.filter(a => a.type === 'video')
  const cleanText = stripOpenClawTags(text)

  // Memoize markdown rendering to avoid re-running regex on unchanged content
  const renderedHtml = useMemo(() => {
    if (!cleanText) return ''
    const isDark = variant === 'mobile'
    const codeBlockStyle = isDark
      ? 'background:rgba(255,255,255,0.05);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:4px 0'
      : variant === 'zen' ? undefined
      : 'background:rgba(0,0,0,0.06);padding:8px 10px;border-radius:6px;overflow-x:auto;font-size:12px;margin:4px 0'
    const inlineCodeStyle = isDark
      ? 'background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:12px'
      : variant === 'zen' ? undefined
      : 'background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px;font-size:12px'
    return renderMarkdown(cleanText, codeBlockStyle, inlineCodeStyle)
  }, [cleanText, variant])

  // ── ZEN variant ────────────────────────────────────────────────
  if (variant === 'zen') {
    if (isSystem) {
      return (
        <div
          className="zen-message zen-message-system zen-fade-in"
          style={{
            alignSelf: 'center',
            color: 'var(--zen-fg-muted)',
            fontStyle: 'italic',
            fontSize: '12px',
            padding: 'var(--zen-space-sm) 0',
          }}
        >
          {cleanText}
        </div>
      )
    }

    return (
      <div
        className={`zen-message ${isUser ? 'zen-message-user' : 'zen-message-assistant'} zen-fade-in`}
      >
        <div className="zen-message-header">
          <span
            className={`zen-message-role ${isUser ? 'zen-message-role-user' : 'zen-message-role-assistant'}`}
          >
            {isUser ? 'YOU' : 'ASSISTANT'}
          </span>
          <span className="zen-message-time">{formatRelativeTime(msg.timestamp)}</span>
        </div>

        {/* Image attachments */}
        {imageAttachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            {imageAttachments.map((attachment, i) => (
              <ImageThumbnail key={i} attachment={attachment} maxWidth={200} />
            ))}
          </div>
        )}

        {/* Video attachments */}
        {videoAttachments.length > 0 && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}
          >
            {videoAttachments.map((attachment, i) => (
              <VideoThumbnail key={i} attachment={attachment} maxWidth={300} />
            ))}
          </div>
        )}

        {/* Thinking blocks */}
        {showThinking && msg.thinking && msg.thinking.length > 0 && (
          <div className="zen-thinking-blocks">
            {msg.thinking.map((thought, i) => (
              <ThinkingBlock key={i} content={thought} zenMode />
            ))}
          </div>
        )}

        {/* Tool calls */}
        {msg.tools && msg.tools.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
            {msg.tools.map((tool, i) => (
              <ToolCallBlock key={i} tool={tool} zenMode />
            ))}
          </div>
        )}

        {/* Message content */}
        {(cleanText || msg.isStreaming) && (
          <div className="zen-message-content">
            {cleanText && (
              <span dangerouslySetInnerHTML={{ __html: renderedHtml }} />
            )}
            {msg.isStreaming && (
              <span style={{ animation: 'streaming-cursor-blink 0.6s step-end infinite' }}>▋</span>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── FLOAT / MOBILE variants (inline-styles) ────────────────────

  const isDark = variant === 'mobile'

  if (isSystem) {
    return (
      <div
        style={{
          textAlign: 'center',
          fontSize: 11,
          color: isDark ? '#64748b' : '#9ca3af',
          fontStyle: 'italic',
          padding: '4px 0',
        }}
      >
        {cleanText}
      </div>
    )
  }

  const bubbleStyle: CSSProperties = isUser
    ? {
        background: accentColor + (isDark ? 'cc' : 'dd'),
        color: '#fff',
        borderRadius: variant === 'mobile' ? '16px 16px 4px 16px' : '14px 14px 4px 14px',
        marginLeft: 48,
        alignSelf: 'flex-end',
      }
    : {
        background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
        color: isDark ? '#e2e8f0' : '#1f2937',
        borderRadius: variant === 'mobile' ? '16px 16px 16px 4px' : '14px 14px 14px 4px',
        marginRight: 48,
        alignSelf: 'flex-start',
      }

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: isUser ? 'flex-end' : 'flex-start',
    gap: 4,
  }

  const mediaMargin = isUser ? { marginLeft: 48 } : { marginRight: 48 }

  return (
    <div style={containerStyle}>
      {/* Thinking blocks */}
      {showThinking && msg.thinking && msg.thinking.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: '100%' }}>
          {msg.thinking.map((thought, i) => (
            <ThinkingBlock key={i} content={thought} />
          ))}
        </div>
      )}

      {/* Tool calls */}
      {msg.tools && msg.tools.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: '100%' }}>
          {msg.tools.map((tool, i) => (
            <ToolCallBlock key={i} tool={tool} showDetails={showToolDetails} />
          ))}
        </div>
      )}

      {/* Text content */}
      {(cleanText || msg.isStreaming) && (
        <div
          style={{
            padding: variant === 'mobile' ? '10px 14px' : '8px 12px',
            fontSize: variant === 'mobile' ? 14 : 13,
            lineHeight: 1.5,
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: '100%',
            ...bubbleStyle,
          }}
        >
          {cleanText && (
            <span dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          )}
          {msg.isStreaming && (
            <span style={{
              display: 'inline',
              animation: 'streaming-cursor-blink 0.6s step-end infinite',
            }}>▋</span>
          )}
        </div>
      )}

      {/* Image attachments */}
      {imageAttachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            maxWidth: '100%',
            ...mediaMargin,
          }}
        >
          {imageAttachments.map((attachment, i) => (
            <ImageThumbnail
              key={i}
              attachment={attachment}
              maxWidth={variant === 'mobile' ? 180 : 200}
            />
          ))}
        </div>
      )}

      {/* Video attachments */}
      {videoAttachments.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxWidth: '100%',
            ...mediaMargin,
          }}
        >
          {videoAttachments.map((attachment, i) => (
            <VideoThumbnail
              key={i}
              attachment={attachment}
              maxWidth={variant === 'mobile' ? 260 : 280}
            />
          ))}
        </div>
      )}

      {/* Timestamp */}
      <div style={{ fontSize: 10, color: isDark ? '#475569' : '#9ca3af', padding: '0 4px' }}>
        {formatTimestamp(msg.timestamp)}
      </div>
    </div>
  )
}, (prev, next) => {
  return (
    prev.msg.content === next.msg.content &&
    prev.msg.isStreaming === next.msg.isStreaming &&
    prev.msg.tools === next.msg.tools &&
    prev.variant === next.variant &&
    prev.showThinking === next.showThinking &&
    prev.showToolDetails === next.showToolDetails
  )
})

export { ChatMessageBubbleInner as ChatMessageBubble }

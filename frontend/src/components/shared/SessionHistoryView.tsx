import { useCallback, useState, type ReactNode } from 'react'
import { formatMessageTime, formatTokens } from '@/lib/formatters'
import type { SessionContentBlock, SessionMessage } from '@/lib/api'

interface SessionHistoryViewProps {
  readonly messages: SessionMessage[]
  readonly loading?: boolean
  readonly error?: string | null
  readonly emptyText?: string
  readonly loadingText?: string
  readonly filterText?: string
  readonly reverseOrder?: boolean
  readonly showCopyButton?: boolean
  readonly toolRoleLabel?: string
}

function ExpandableBlock({
  label,
  className,
  children,
}: Readonly<{
  readonly label: string
  readonly className: string
  readonly children: ReactNode
}>) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={className}>
      <button className="zen-sd-tool-toggle" onClick={() => setExpanded(!expanded)}>
        {label} {expanded ? '▾' : '▸'}
      </button>
      {expanded && children}
    </div>
  )
}

function highlightMatch(text: string, query?: string): ReactNode {
  if (!query) return text
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return text
  return (
    <>
      {text.slice(0, index)}
      <mark
        style={{
          background: 'var(--zen-warning, #f0c040)',
          color: '#000',
          borderRadius: 2,
          padding: '0 1px',
        }}
      >
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  )
}

function ContentBlockView({
  block,
  filterText,
}: Readonly<{
  readonly block: SessionContentBlock
  readonly filterText?: string
}>) {
  if (block.type === 'text' && block.text) {
    return <div className="zen-sd-text">{highlightMatch(block.text, filterText)}</div>
  }

  if (block.type === 'thinking' && block.thinking) {
    return (
      <ExpandableBlock label="💭 Thinking" className="zen-sd-thinking">
        <pre className="zen-sd-thinking-content">{block.thinking}</pre>
      </ExpandableBlock>
    )
  }

  if (block.type === 'tool_use') {
    return (
      <ExpandableBlock label={`🔧 ${block.name || 'Tool'}`} className="zen-sd-tool-call">
        {block.arguments && (
          <pre className="zen-sd-tool-args">{JSON.stringify(block.arguments, null, 2)}</pre>
        )}
      </ExpandableBlock>
    )
  }

  if (block.type === 'tool_result') {
    const text =
      block.content
        ?.map((content) => content.text)
        .filter(Boolean)
        .join('\n') || ''

    if (!text) return null

    return (
      <ExpandableBlock
        label={`${block.isError ? '❌' : '✅'} Result`}
        className={`zen-sd-tool-result ${block.isError ? 'zen-sd-tool-error' : ''}`}
      >
        <pre className="zen-sd-tool-result-content">{text}</pre>
      </ExpandableBlock>
    )
  }

  return null
}

function MessageBubble({
  message,
  filterText,
  showCopyButton,
  toolRoleLabel,
}: Readonly<{
  readonly message: SessionMessage
  readonly filterText?: string
  readonly showCopyButton: boolean
  readonly toolRoleLabel: string
}>) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const messageRole = isUser ? 'user' : isSystem ? 'system' : 'assistant'

  const copyContent = useCallback(() => {
    const text =
      message.content
        ?.filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n') || ''
    navigator.clipboard.writeText(text)
  }, [message])

  return (
    <div className={`zen-sd-message zen-sd-message-${messageRole}`}>
      <div className="zen-sd-message-header">
        <div className="zen-sd-message-header-top">
          <span className="zen-sd-message-role">
            {(() => {
              if (isUser) return '👤 User'
              if (isSystem) return '⚙️ System'
              if (message.role === 'toolResult') return toolRoleLabel
              return '🤖 Assistant'
            })()}
          </span>
          {message.timestamp && (
            <span className="zen-sd-message-timestamp">{formatMessageTime(message.timestamp)}</span>
          )}
          {showCopyButton && (
            <button className="zen-sd-copy-btn" onClick={copyContent} title="Copy">
              📋
            </button>
          )}
        </div>
        {(message.usage || message.model) && (
          <div className="zen-sd-message-meta-line">
            {message.usage && (
              <span className="zen-sd-message-tokens">
                {formatTokens(message.usage.totalTokens)} tok
              </span>
            )}
            {message.model && (
              <span className="zen-sd-message-model">{message.model.split('/').pop()}</span>
            )}
          </div>
        )}
      </div>
      <div className="zen-sd-message-body">
        {message.content?.map((block, index) => (
          <ContentBlockView key={`${block.type}-${index}`} block={block} filterText={filterText} />
        ))}
      </div>
    </div>
  )
}

export function SessionHistoryView({
  messages,
  loading,
  error,
  emptyText = 'No messages in history',
  loadingText = 'Loading history...',
  filterText,
  reverseOrder = false,
  showCopyButton = true,
  toolRoleLabel = '🔧 Tool',
}: SessionHistoryViewProps) {
  const displayMessages = reverseOrder ? [...messages].reverse() : messages

  return (
    <>
      {loading && (
        <div className="zen-sd-loading">
          <div className="zen-thinking-dots">
            <span />
            <span />
            <span />
          </div>
          {loadingText}
        </div>
      )}
      {error && <div className="zen-sd-error">❌ {error}</div>}
      {!loading && !error && displayMessages.length === 0 && (
        <div className="zen-sd-empty">{emptyText}</div>
      )}
      {displayMessages.map((message) => (
        <MessageBubble
          key={`${message.timestamp || ''}-${message.role || ''}-${message.model || ''}-${JSON.stringify(message.content || [])}`}
          message={message}
          filterText={filterText}
          showCopyButton={showCopyButton}
          toolRoleLabel={toolRoleLabel}
        />
      ))}
    </>
  )
}

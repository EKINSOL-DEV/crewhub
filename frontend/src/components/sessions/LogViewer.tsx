import { useState, useEffect, useRef, useCallback } from 'react'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Download, Search, X, ArrowDown, Loader2, FileText, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import type { MinionSession, MinionMessage } from '@/lib/api'
import { getSessionDisplayName, getMinionType, formatModel, timeAgo } from '@/lib/minionUtils'
import { cn } from '@/lib/utils'
import { EditableSessionName } from './EditableSessionName'

function safeJsonKey(value: unknown): string {
  if (value == null) return ''
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return ''
  }
}

interface LogViewerProps {
  readonly session: MinionSession | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

/**
 * LogViewer - Full session log viewer dialog
 *
 * Uses native <dialog> element to avoid React 19 compatibility issues
 * with @radix-ui/react-compose-refs (infinite update loops).
 * See: https://github.com/radix-ui/primitives/issues/3799
 */
export function LogViewer({ session, open, onOpenChange }: LogViewerProps) {
  // NOSONAR
  // NOSONAR: complexity from log viewer with multiple message format handlers
  const [messages, setMessages] = useState<MinionMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastMessageCountRef = useRef(0)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Sync open state with native dialog
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open) {
      if (!dialog.open) {
        dialog.showModal()
      }
    } else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  // Handle native dialog close (ESC key)
  const handleDialogClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === e.currentTarget) {
        onOpenChange(false)
      }
    },
    [onOpenChange]
  )

  useEffect(() => {
    if (open && session) fetchMessages()
  }, [open, session])

  useEffect(() => {
    if (!open || !session) return
    const interval = setInterval(() => fetchMessages(true), SESSION_CONFIG.logViewerPollMs)
    return () => clearInterval(interval)
  }, [open, session])

  useEffect(() => {
    if (autoScroll && messages.length > lastMessageCountRef.current) scrollToBottom()
    lastMessageCountRef.current = messages.length
  }, [messages, autoScroll])

  const fetchMessages = async (silent = false) => {
    if (!session) return
    try {
      if (silent) {
        setIsRefreshing(true)
      } else {
        setLoading(true)
        setError(null)
      }
      const response = await api.getMinionHistory(session.key, 100)
      // Transform messages - handle both direct messages and wrapped {message, timestamp} format
      const transformedMessages = (response.messages || []).map((item: any) => {
        if (item.message)
          return {
            ...item.message,
            timestamp: item.timestamp ? new Date(item.timestamp).getTime() : undefined,
          }
        return item
      }) as MinionMessage[]
      setMessages(transformedMessages)
    } catch (err) {
      console.warn('Failed to load session history:', err)
      if (!silent) setError('Failed to load session history')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }

  const scrollToBottom = () => {
    if (scrollContainerRef.current)
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
  }

  const handleScroll = () => {
    if (!scrollContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    if (isAtBottom && !autoScroll) setAutoScroll(true)
    else if (!isAtBottom && autoScroll) setAutoScroll(false)
  }

  const exportToJSON = () => {
    if (!session) return
    const data = {
      session: {
        key: session.key,
        displayName: getSessionDisplayName(session),
        model: session.model,
        exportedAt: new Date().toISOString(),
      },
      messages,
      stats: {
        totalMessages: messages.length,
        totalTokens: messages.reduce((sum, msg) => sum + (msg.usage?.totalTokens || 0), 0),
        totalCost: messages.reduce((sum, msg) => sum + (msg.usage?.cost?.total || 0), 0),
      },
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${session.key.replaceAll(/[:/]/g, '-')}-${Date.now()}.json`
    a.click()
  }

  const filteredMessages = messages.filter((msg) => {
    if (roleFilter !== 'all' && msg.role !== roleFilter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!msg.content || !Array.isArray(msg.content)) return false
      return msg.content.some(
        (block) =>
          block?.text?.toLowerCase().includes(query) ||
          block?.thinking?.toLowerCase().includes(query) ||
          block?.name?.toLowerCase().includes(query)
      )
    }
    return true
  })

  if (!session) return null
  const minionType = getMinionType(session)
  const displayName = getSessionDisplayName(session)

  return (
    <dialog // NOSONAR: <dialog> is a native interactive HTML element
      ref={dialogRef}
      onClose={handleDialogClose}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[60] m-0 h-screen w-screen max-h-none max-w-none bg-transparent p-0 overflow-y-auto backdrop:bg-black/80 open:flex open:items-center open:justify-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation" // NOSONAR: decorative/overlay element; presentation role is appropriate here
        className="relative w-[calc(100vw-2rem)] sm:max-w-4xl h-[calc(100vh-2rem)] sm:max-h-[90vh] flex flex-col border bg-background shadow-lg sm:rounded-lg animate-in fade-in-0 zoom-in-95 duration-200"
      >
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl border-2 shrink-0"
              style={{ backgroundColor: `${minionType.color}20`, borderColor: minionType.color }}
            >
              {minionType.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold leading-none tracking-tight flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Logs:{' '}
                <EditableSessionName
                  sessionKey={session.key}
                  fallbackName={displayName}
                  showEditIcon={true}
                />
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <Badge variant="outline" className="text-[10px]">
                  {minionType.type}
                </Badge>
                {session.model && (
                  <>
                    <span>·</span>
                    <span>{formatModel(session.model)}</span>
                  </>
                )}
                <span>·</span>
                <span>Last activity: {timeAgo(session.updatedAt)}</span>
                {session.totalTokens && (
                  <>
                    <span>·</span>
                    <span>{session.totalTokens.toLocaleString()} tokens</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant={autoScroll ? 'default' : 'outline'}
              onClick={() => setAutoScroll(!autoScroll)}
              className="h-8"
            >
              <ArrowDown className={cn('h-3.5 w-3.5 mr-1.5', autoScroll && 'animate-bounce')} />
              Auto-scroll {autoScroll ? 'ON' : 'OFF'}
            </Button>
            {/* Native select to avoid Radix React 19 bug */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-8 w-[140px] rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="assistant">Assistant</option>
              <option value="system">System</option>
            </select>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-8"
              />
              {searchQuery && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-0 top-0 h-8 w-8 p-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={exportToJSON} className="h-8">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              JSON
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fetchMessages()}
              className="h-8 w-8 p-0"
              disabled={loading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
            </Button>
          </div>
          {searchQuery && (
            <div className="text-xs text-muted-foreground mt-2">
              Found {filteredMessages.length} message{filteredMessages.length === 1 ? '' : 's'}
            </div>
          )}
        </div>

        {/* Content */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4"
        >
          {(() => {
            if (loading) {
              return (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )
            }

            if (error) {
              return (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <p className="text-sm text-muted-foreground">{error}</p>
                  <Button size="sm" onClick={() => fetchMessages()}>
                    Retry
                  </Button>
                </div>
              )
            }

            if (filteredMessages.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || roleFilter !== 'all'
                      ? 'No messages match your filters'
                      : 'No messages yet'}
                  </p>
                </div>
              )
            }

            return (
              <div className="space-y-4">
                {filteredMessages.map((msg) => (
                  <div
                    key={`msg-${msg.timestamp ?? ''}-${msg.role}-${safeJsonKey(msg.content)}`}
                    className={cn(
                      'p-3 rounded-lg',
                      (() => {
                        if (msg.role === 'user') return 'bg-blue-50 dark:bg-blue-950'
                        if (msg.role === 'system') return 'bg-gray-50 dark:bg-gray-950'
                        return 'bg-green-50 dark:bg-green-950'
                      })()
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                      <span className="font-semibold">{msg.role}</span>
                      {msg.timestamp && <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>}
                      {msg.usage && (
                        <span className="ml-auto">
                          {msg.usage.totalTokens} tokens · ${msg.usage.cost?.total.toFixed(4)}
                        </span>
                      )}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {msg.content?.map((block) => (
                        <div
                          key={
                            block.id ??
                            block.toolCallId ??
                            `${block.type}-${block.name ?? ''}-${block.text ?? block.thinking ?? ''}-${safeJsonKey(block.arguments)}`
                          }
                        >
                          {block.type === 'text' && block.text && <span>{block.text}</span>}
                          {block.type === 'thinking' && block.thinking && (
                            <div className="text-purple-600 dark:text-purple-400 italic">
                              💭 {block.thinking}
                            </div>
                          )}
                          {(block.type === 'tool_use' || block.type === 'toolCall') && (
                            <div className="text-amber-600 dark:text-amber-400">
                              🔧 {block.name}
                            </div>
                          )}
                          {block.type === 'tool_result' && (
                            <div className="text-gray-500">✓ Result</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-center py-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        isRefreshing ? 'bg-green-500 animate-pulse' : 'bg-green-500'
                      )}
                    />
                    <span>Live - auto-refreshing every 3s</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/30 text-xs text-muted-foreground shrink-0">
          <div className="flex items-center gap-4 justify-between flex-wrap">
            <div className="flex items-center gap-4">
              <span>
                📊 {filteredMessages.length} message{filteredMessages.length === 1 ? '' : 's'}
              </span>
              {messages.length > 0 && (
                <>
                  <span>·</span>
                  <span>
                    {messages
                      .reduce((sum, msg) => sum + (msg.usage?.totalTokens || 0), 0)
                      .toLocaleString()}{' '}
                    tokens
                  </span>
                  <span>·</span>
                  <span>
                    $
                    {messages
                      .reduce((sum, msg) => sum + (msg.usage?.cost?.total || 0), 0)
                      .toFixed(4)}{' '}
                    total
                  </span>
                </>
              )}
            </div>
            <div className="text-[10px]">
              Session:{' '}
              <code className="bg-black/10 dark:bg-white/10 px-1 rounded">{session.key}</code>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  )
}

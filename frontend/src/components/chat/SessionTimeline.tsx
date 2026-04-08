/**
 * SessionTimeline — horizontal timeline showing chat events as colored dots.
 * Collapsible, shown above the chat messages area.
 */
import { memo, useMemo, useCallback } from 'react'
import type { ChatMessageData } from '@/hooks/useStreamingChat'

interface SessionTimelineProps {
  readonly messages: ChatMessageData[]
  readonly onEventClick: (messageId: string) => void
}

const EVENT_COLORS: Record<string, string> = {
  user: '#60a5fa', // blue
  assistant: '#4ade80', // green
  tool: '#f59e0b', // amber
  thinking: '#a78bfa', // purple
  error: '#ef4444', // red
}

function getEventType(msg: ChatMessageData): string {
  if (msg.content?.startsWith('[Error')) return 'error'
  if (msg.thinking && msg.thinking.length > 0) return 'thinking'
  if (msg.tools && msg.tools.length > 0) return 'tool'
  return msg.role
}

export const SessionTimeline = memo(function SessionTimeline({
  messages,
  onEventClick,
}: SessionTimelineProps) {
  const events = useMemo(
    () =>
      messages.map((msg) => ({
        id: msg.id,
        type: getEventType(msg),
        timestamp: msg.timestamp,
        preview:
          msg.role === 'user'
            ? msg.content.slice(0, 40)
            : msg.tools?.[0]?.name || msg.content.slice(0, 40),
      })),
    [messages]
  )

  const handleClick = useCallback(
    (id: string) => {
      onEventClick(id)
      // Scroll the message into view
      const el = document.getElementById(`msg-${id}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    [onEventClick]
  )

  if (events.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '6px 12px',
        background: 'rgba(0, 0, 0, 0.04)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        overflowX: 'auto',
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: '#9ca3af',
          marginRight: 8,
          flexShrink: 0,
        }}
      >
        Timeline
      </span>
      {events.map((event) => (
        <button
          key={event.id}
          onClick={() => handleClick(event.id)}
          title={`${event.type}: ${event.preview}`}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: EVENT_COLORS[event.type] || '#6b7280',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'transform 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
        />
      ))}
    </div>
  )
})

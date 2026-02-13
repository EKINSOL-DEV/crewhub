/**
 * MeetingHistoryBrowser — Browse past meetings with pagination.
 * F5: Meeting History feature.
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { API_BASE } from '@/lib/api'

interface MeetingHistoryItem {
  id: string
  title: string
  goal: string
  state: string
  participant_count: number
  participant_names: string[]
  num_rounds: number
  room_id?: string
  project_id?: string
  duration_seconds?: number
  parent_meeting_id?: string
  created_at: number
  completed_at?: number
}

interface MeetingHistoryBrowserProps {
  roomId?: string
  projectId?: string
  onViewResults: (meetingId: string) => void
  onFollowUp: (meetingId: string) => void
  onReuseSetup: (meeting: MeetingHistoryItem) => void
}

function MeetingHistoryCard({
  meeting,
  onViewResults,
  onFollowUp,
  onReuseSetup,
}: {
  meeting: MeetingHistoryItem
  onViewResults: () => void
  onFollowUp: () => void
  onReuseSetup: () => void
}) {
  const date = new Date(meeting.created_at)
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const stateColor = {
    complete: 'bg-green-500/15 text-green-700 dark:text-green-400',
    error: 'bg-red-500/15 text-red-700 dark:text-red-400',
    cancelled: 'bg-gray-500/15 text-gray-700 dark:text-gray-400',
  }[meeting.state] || 'bg-blue-500/15 text-blue-700 dark:text-blue-400'

  return (
    <Card className="hover:bg-muted/30 transition-colors">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-medium truncate">📝 {meeting.title}</h4>
            {meeting.goal && meeting.goal !== meeting.title && (
              <p className="text-xs text-muted-foreground truncate">{meeting.goal}</p>
            )}
          </div>
          <Badge variant="secondary" className={`text-xs shrink-0 ${stateColor}`}>
            {meeting.state}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{dateStr} {timeStr}</span>
          <span>{meeting.num_rounds} rounds</span>
          {meeting.duration_seconds && <span>{Math.round(meeting.duration_seconds)}s</span>}
          {meeting.parent_meeting_id && <span>🔄 follow-up</span>}
        </div>

        {meeting.participant_names.length > 0 && (
          <div className="text-xs text-muted-foreground">
            🤖 {meeting.participant_names.join(', ')}
          </div>
        )}

        {meeting.state === 'complete' && (
          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onViewResults}>
              📄 Results
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onFollowUp}>
              🔄 Follow-up
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={onReuseSetup}>
              ♻️ Reuse
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MeetingHistoryBrowser({
  roomId,
  projectId,
  onViewResults,
  onFollowUp,
  onReuseSetup,
}: MeetingHistoryBrowserProps) {
  const [meetings, setMeetings] = useState<MeetingHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 20

  const fetchHistory = useCallback(async (newOffset: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(newOffset),
        days: '365',
      })
      if (roomId) params.set('room_id', roomId)
      if (projectId) params.set('project_id', projectId)

      const res = await fetch(`${API_BASE}/meetings/history?${params}`)
      if (!res.ok) return

      const data = await res.json()
      if (newOffset === 0) {
        setMeetings(data.meetings)
      } else {
        setMeetings(prev => [...prev, ...data.meetings])
      }
      setTotal(data.total)
      setHasMore(data.has_more)
      setOffset(newOffset)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [roomId, projectId])

  useEffect(() => {
    fetchHistory(0)
  }, [fetchHistory])

  if (loading && meetings.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading meeting history…
      </div>
    )
  }

  if (meetings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground space-y-2">
        <span>📋 No meetings yet</span>
        <span className="text-xs">Start a meeting from the New Meeting tab</span>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        {total} meeting{total !== 1 ? 's' : ''}
      </div>
      <ScrollArea className="max-h-[60vh]">
        <div className="space-y-2 pr-2">
          {meetings.map(m => (
            <MeetingHistoryCard
              key={m.id}
              meeting={m}
              onViewResults={() => onViewResults(m.id)}
              onFollowUp={() => onFollowUp(m.id)}
              onReuseSetup={() => onReuseSetup(m)}
            />
          ))}
        </div>
      </ScrollArea>
      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => fetchHistory(offset + limit)}
          disabled={loading}
        >
          {loading ? 'Loading…' : `Load More (${meetings.length} of ${total})`}
        </Button>
      )}
    </div>
  )
}

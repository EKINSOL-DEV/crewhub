/**
 * MeetingOutput — Rich structured results view after meeting completes.
 *
 * Uses the shared MarkdownViewer for rendering meeting markdown,
 * with interactive action item cards layered on top.
 *
 * Features: F2 (sidebar), F3 (better UI), F1 (action item buttons), F4 (follow-up)
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { MarkdownViewer } from '@/components/markdown/MarkdownViewer'
import type { MeetingState, MeetingRound } from '@/hooks/useMeeting'
import { parseMeetingOutput, type ParsedActionItem } from '@/lib/parseMeetingOutput'
import { showToast } from '@/lib/toast'
import { API_BASE } from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────

interface MeetingOutputProps {
  meeting: MeetingState
  onClose: () => void
  onRetryFetch?: () => Promise<unknown>
  outputLoading?: boolean
  outputError?: string | null
  mode?: 'dialog' | 'sidebar'
  onOpenInSidebar?: () => void
  onStartFollowUp?: () => void
}

// ─── Action Item Components (interactive layer on top of markdown) ───

function ActionItemCard({
  item,
  meetingId,
  onStatusChange,
}: {
  item: ParsedActionItem & { status?: string }
  meetingId: string | null
  onStatusChange: (id: string, status: string) => void
}) {
  const [loading, setLoading] = useState<'planner' | 'execute' | null>(null)

  const priorityColor = {
    high: 'bg-red-500/15 text-red-700 dark:text-red-400',
    medium: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
    low: 'bg-green-500/15 text-green-700 dark:text-green-400',
  }[item.priority]

  const handleAddToPlanner = async () => {
    if (!meetingId) return
    setLoading('planner')
    try {
      const res = await fetch(`${API_BASE}/meetings/${meetingId}/action-items/${item.id}/to-planner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.text, assignee: item.assignee, priority: item.priority }),
      })
      if (res.ok) {
        onStatusChange(item.id, 'planned')
        showToast({ message: '✅ Added to Planner' })
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed' }))
        showToast({ message: `❌ ${err.detail || 'Failed to add to Planner'}` })
      }
    } catch {
      showToast({ message: '❌ Planner not reachable' })
    } finally {
      setLoading(null)
    }
  }

  const handleExecute = async () => {
    if (!meetingId) return
    if (!confirm(`Execute action item with ${item.assignee || 'agent'}?\n\n"${item.text}"`)) return
    setLoading('execute')
    try {
      const res = await fetch(`${API_BASE}/meetings/${meetingId}/action-items/${item.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: item.assignee }),
      })
      if (res.ok) {
        onStatusChange(item.id, 'executing')
        showToast({ message: '🤖 Agent executing...' })
      } else {
        const err = await res.json().catch(() => ({ detail: 'Failed' }))
        showToast({ message: `❌ ${err.detail || 'Failed to execute'}` })
      }
    } catch {
      showToast({ message: '❌ Failed to reach agent' })
    } finally {
      setLoading(null)
    }
  }

  const status = item.status || 'pending'

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <input type="checkbox" checked={item.checked || status === 'done'} readOnly className="mt-1 rounded" />
        <div className="flex-1 min-w-0">
          <p className="text-sm">{item.text}</p>
          <div className="flex items-center gap-2 mt-1">
            {item.assignee && <span className="text-xs text-muted-foreground">👤 {item.assignee}</span>}
            <Badge variant="secondary" className={`text-xs ${priorityColor}`}>{item.priority}</Badge>
            {status !== 'pending' && (
              <Badge variant="outline" className="text-xs">
                {status === 'planned' ? '📋 Planned' : status === 'executing' ? '⚡ Executing' : status === 'done' ? '✅ Done' : status === 'failed' ? '❌ Failed' : status}
              </Badge>
            )}
          </div>
        </div>
      </div>
      {status === 'pending' && (
        <div className="flex gap-2 ml-6">
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleAddToPlanner} disabled={loading !== null}>
            {loading === 'planner' ? '...' : '➕ Add to Planner'}
          </Button>
          {item.assignee && (
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleExecute} disabled={loading !== null}>
              {loading === 'execute' ? '...' : '🤖 Execute Now'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function ActionItemsPanel({
  items,
  meetingId,
  onStatusChange,
}: {
  items: (ParsedActionItem & { status?: string })[]
  meetingId: string | null
  onStatusChange: (id: string, status: string) => void
}) {
  if (items.length === 0) return null
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">✅ Action Items ({items.length})</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {items.map(item => (
          <ActionItemCard key={item.id} item={item} meetingId={meetingId} onStatusChange={onStatusChange} />
        ))}
      </CardContent>
    </Card>
  )
}

function RoundAccordion({ rounds }: { rounds: MeetingRound[] }) {
  if (rounds.length === 0) return null
  return (
    <Accordion type="multiple" className="w-full">
      {rounds.map((round) => (
        <AccordionItem key={round.roundNum} value={`round-${round.roundNum}`}>
          <AccordionTrigger className="text-sm py-2">
            Round {round.roundNum}: {round.topic}
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              {round.turns.map((turn, i) => (
                <div key={i}>
                  <div className="text-xs font-medium">{turn.agentName}</div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">
                    {turn.response || '(no response)'}
                  </p>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

// ─── Main Component ─────────────────────────────────────────────

type ViewMode = 'structured' | 'markdown' | 'transcript'

export function MeetingOutput({
  meeting,
  onClose,
  onRetryFetch,
  outputLoading,
  outputError,
  mode = 'dialog',
  onOpenInSidebar,
  onStartFollowUp,
}: MeetingOutputProps) {
  const [copied, setCopied] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('structured')
  const [itemStatuses, setItemStatuses] = useState<Record<string, string>>({})

  const parsed = useMemo(
    () => parseMeetingOutput(meeting.outputMd || ''),
    [meeting.outputMd]
  )

  // Save action items to backend when parsed
  useEffect(() => {
    if (parsed.actionItems.length > 0 && meeting.meetingId) {
      fetch(`${API_BASE}/meetings/${meeting.meetingId}/action-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: parsed.actionItems.map(ai => ({
            id: ai.id,
            text: ai.text,
            assignee_agent_id: ai.assignee,
            priority: ai.priority,
          })),
        }),
      }).catch(() => {})
    }
  }, [parsed.actionItems, meeting.meetingId])

  const handleCopy = useCallback(async () => {
    const text = meeting.outputMd || 'No output available'
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [meeting.outputMd])

  const handleStatusChange = useCallback((id: string, status: string) => {
    setItemStatuses(prev => ({ ...prev, [id]: status }))
  }, [])

  // Build markdown without the Action Items section (we render those interactively)
  const markdownWithoutActions = useMemo(() => {
    if (!meeting.outputMd) return ''
    // Strip the Action Items section so we can render it as interactive cards
    const lines = meeting.outputMd.split('\n')
    const result: string[] = []
    let inActionItems = false
    for (const line of lines) {
      if (/^##\s+(Action Items|Next Steps)/i.test(line)) {
        inActionItems = true
        continue
      }
      if (inActionItems && /^##\s/.test(line)) {
        inActionItems = false
      }
      if (!inActionItems) {
        result.push(line)
      }
    }
    return result.join('\n')
  }, [meeting.outputMd])

  const viewToggleLabel = {
    structured: 'Markdown',
    markdown: 'Transcript',
    transcript: 'Structured',
  }[viewMode]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header bar */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">✅ Meeting Complete</h3>
          {meeting.durationSeconds && (
            <span className="text-xs text-muted-foreground">⏱ {Math.round(meeting.durationSeconds)}s</span>
          )}
        </div>
        <button
          className="text-xs text-primary hover:underline"
          onClick={() => setViewMode(viewMode === 'structured' ? 'markdown' : viewMode === 'markdown' ? 'transcript' : 'structured')}
        >
          {viewToggleLabel} →
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4 py-3">
        {meeting.outputMd ? (
          viewMode === 'structured' ? (
            /* Structured view: MarkdownViewer for prose + interactive ActionItems */
            <div className="space-y-4">
              <MarkdownViewer content={markdownWithoutActions} className="text-sm" />
              <ActionItemsPanel
                items={parsed.actionItems.map(ai => ({ ...ai, status: itemStatuses[ai.id] }))}
                meetingId={meeting.meetingId}
                onStatusChange={handleStatusChange}
              />
              {meeting.rounds.length > 0 && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Full Transcript</p>
                  <RoundAccordion rounds={meeting.rounds} />
                </div>
              )}
            </div>
          ) : viewMode === 'markdown' ? (
            /* Full markdown view using shared MarkdownViewer */
            <MarkdownViewer content={meeting.outputMd} className="text-sm" />
          ) : (
            /* Transcript view */
            <div className="space-y-4">
              {meeting.rounds.map((round) => (
                <div key={round.roundNum}>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1 mb-2">
                    Round {round.roundNum}: {round.topic}
                  </div>
                  {round.turns.map((turn, i) => (
                    <div key={i} className="mb-3">
                      <div className="text-sm font-medium">{turn.agentName}:</div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">
                        {turn.response || '(no response)'}
                      </p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        ) : outputError ? (
          <div className="text-center py-8 space-y-3">
            <div className="text-sm text-destructive">⚠️ {outputError}</div>
            {onRetryFetch && (
              <Button variant="outline" size="sm" onClick={() => onRetryFetch()}>🔄 Retry</Button>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-8">
            {outputLoading ? 'Loading output…' : 'Loading output…'}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t space-y-2">
        {meeting.outputPath && (
          <div className="text-xs text-muted-foreground truncate">💾 {meeting.outputPath}</div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </Button>
          {mode === 'dialog' && onOpenInSidebar && (
            <Button variant="outline" size="sm" onClick={onOpenInSidebar}>📌 Sidebar</Button>
          )}
          {onStartFollowUp && (
            <Button variant="outline" size="sm" onClick={onStartFollowUp}>🔄 Follow-up</Button>
          )}
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}

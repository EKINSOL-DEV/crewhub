/**
 * MeetingOutput — Rich structured results view after meeting completes.
 *
 * Redesigned to match FullscreenOverlay (markdown viewer) layout:
 * - Top bar: title left, X close right, action buttons below
 * - Left sidebar: view menu (structured, actions, transcript, raw)
 * - Main content: switches based on active view
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarkdownViewer } from '@/components/markdown/MarkdownViewer'
import { MeetingViewMenu, type MeetingView } from './MeetingViewMenu'
import type { MeetingState, MeetingRound } from '@/hooks/useMeeting'
import { parseMeetingOutput, type ParsedActionItem } from '@/lib/parseMeetingOutput'
import { showToast } from '@/lib/toast'
import { API_BASE } from '@/lib/api'

const APPLICATION_JSON = 'application/json'
const BORDER_1PX_SOLID_HSL_VAR_BORDER = '1px solid hsl(var(--border))'
const HSL_CARD = 'hsl(var(--card))'
const HSL_FOREGROUND = 'hsl(var(--foreground))'
const HSL_MUTED_FOREGROUND = 'hsl(var(--muted-foreground))'

// ─── Types ──────────────────────────────────────────────────────

interface MeetingOutputProps {
  readonly meeting: MeetingState
  readonly onClose: () => void
  readonly onRetryFetch?: () => Promise<unknown>
  readonly outputLoading?: boolean
  readonly outputError?: string | null
  readonly mode?: 'dialog' | 'sidebar' | 'fullscreen'
  readonly onOpenInSidebar?: () => void
  readonly onStartFollowUp?: () => void
}

// ─── Action Item Card ───────────────────────────────────────────

function ActionItemCard({
  item,
  meetingId,
  projectId,
  onStatusChange,
}: {
  readonly item: ParsedActionItem & { status?: string }
  readonly meetingId: string | null
  readonly projectId?: string
  readonly onStatusChange: (id: string, status: string) => void
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
      const res = await fetch(
        `${API_BASE}/meetings/${meetingId}/action-items/${item.id}/to-planner`,
        {
          method: 'POST',
          headers: { CONTENT_TYPE: APPLICATION_JSON },
          body: JSON.stringify({
            title: item.text,
            assignee: item.assignee,
            priority: item.priority,
            project_id: projectId,
          }),
        }
      )
      if (res.ok) {
        onStatusChange(item.id, 'planned')
        showToast({ message: `✅ Task added to project board`, duration: 4000 })
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
        headers: { CONTENT_TYPE: APPLICATION_JSON },
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
    <div
      style={{
        border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
        borderRadius: 8,
        padding: 12,
        background: HSL_CARD,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <input
          type="checkbox"
          checked={item.checked || status === 'done'}
          readOnly
          style={{ marginTop: 3, borderRadius: 3 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>{item.text}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {item.assignee && (
              <span style={{ fontSize: 11, color: HSL_MUTED_FOREGROUND }}>👤 {item.assignee}</span>
            )}
            <Badge variant="secondary" className={`text-xs ${priorityColor}`}>
              {item.priority}
            </Badge>
            {status !== 'pending' && (
              <Badge variant="outline" className="text-xs">
                {(() => {
                  if (status === 'planned') return '📋 Planned'
                  if (status === 'executing') return '⚡ Executing'
                  if (status === 'done') return '✅ Done'
                  if (status === 'failed') return '❌ Failed'
                  return status
                })()}
              </Badge>
            )}
          </div>
        </div>
      </div>
      {status === 'pending' && (
        <div style={{ display: 'flex', gap: 8, marginLeft: 24, marginTop: 8 }}>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={handleAddToPlanner}
            disabled={loading !== null}
          >
            {loading === 'planner' ? '⏳ Adding…' : '➕ Planner'}
          </Button>
          {item.assignee && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={handleExecute}
              disabled={loading !== null}
            >
              {loading === 'execute' ? '⏳ Starting…' : '🤖 Execute'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Transcript View ────────────────────────────────────────────

function TranscriptView({ rounds }: { rounds: MeetingRound[] }) {
  if (rounds.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 0',
          color: HSL_MUTED_FOREGROUND,
          fontSize: 13,
        }}
      >
        No transcript available
      </div>
    )
  }
  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {rounds.map((round) => (
        <div key={round.roundNum} style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: HSL_MUTED_FOREGROUND,
              borderBottom: BORDER_1PX_SOLID_HSL_VAR_BORDER,
              paddingBottom: 6,
              marginBottom: 12,
            }}
          >
            Round {round.roundNum}: {round.topic}
          </div>
          {round.turns.map((turn, i) => (
            <div key={`turn-${i}`} style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: HSL_FOREGROUND,
                  marginBottom: 2,
                }}
              >
                {turn.agentName}
              </div>
              <p
                style={{
                  fontSize: 13,
                  color: HSL_MUTED_FOREGROUND,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {turn.response || '(no response)'}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Actions View ───────────────────────────────────────────────

function ActionsView({
  items,
  meetingId,
  projectId,
  onStatusChange,
}: {
  readonly items: (ParsedActionItem & { status?: string })[]
  readonly meetingId: string | null
  readonly projectId?: string
  readonly onStatusChange: (id: string, status: string) => void
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 0',
          color: HSL_MUTED_FOREGROUND,
          fontSize: 13,
        }}
      >
        No action items found
      </div>
    )
  }
  return (
    <div
      style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: HSL_MUTED_FOREGROUND,
          marginBottom: 4,
        }}
      >
        {items.length} Action Item{items.length === 1 ? '' : 's'}
      </div>
      {items.map((item) => (
        <ActionItemCard
          key={item.id}
          item={item}
          meetingId={meetingId}
          projectId={projectId}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export function MeetingOutput({
  // NOSONAR: complexity from legitimate meeting output rendering with multiple content types
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
  const [activeView, setActiveView] = useState<MeetingView>('structured')
  const [itemStatuses, setItemStatuses] = useState<Record<string, string>>({})
  const [backendItems, setBackendItems] = useState<
    (ParsedActionItem & { status?: string })[] | null
  >(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const parsed = useMemo(() => parseMeetingOutput(meeting.outputMd || ''), [meeting.outputMd])

  // Fetch action items from backend (source of truth for IDs) or save parsed ones if none exist
  const syncedForMeetingRef = useRef<string | null>(null)
  useEffect(() => {
    if (!meeting.meetingId || syncedForMeetingRef.current === meeting.meetingId) return
    syncedForMeetingRef.current = meeting.meetingId
    const meetingId = meeting.meetingId

    // First try to fetch existing items from backend
    fetch(`${API_BASE}/meetings/${meetingId}/action-items`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items?.length > 0) {
          // Backend has items — use their IDs (they match the DB)
          setBackendItems(
            data.items.map((item: any) => ({
              id: item.id,
              text: item.text,
              assignee: item.assignee_agent_id,
              priority: item.priority || 'medium',
              checked: item.status === 'done',
              status: item.status,
            }))
          )
          // Seed statuses from backend
          const statuses: Record<string, string> = {}
          for (const item of data.items) {
            if (item.status && item.status !== 'pending') statuses[item.id] = item.status
          }
          setItemStatuses((prev) => ({ ...prev, ...statuses }))
        } else if (parsed.actionItems.length > 0) {
          // No backend items — save parsed ones (creates them with parsed IDs)
          fetch(`${API_BASE}/meetings/${meetingId}/action-items`, {
            method: 'POST',
            headers: { CONTENT_TYPE: APPLICATION_JSON },
            body: JSON.stringify({
              items: parsed.actionItems.map((ai) => ({
                id: ai.id,
                text: ai.text,
                assignee_agent_id: ai.assignee,
                priority: ai.priority,
              })),
            }),
          })
            .then((r) => {
              if (!r.ok) console.warn('[MeetingOutput] Failed to save action items:', r.status)
            })
            .catch((err) => console.warn('[MeetingOutput] Failed to save action items:', err))
          // Use parsed items (IDs will match what we just saved)
          setBackendItems(null)
        }
      })
      .catch((err) => {
        console.warn('[MeetingOutput] Failed to fetch action items:', err)
        setBackendItems(null)
      })
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
      document.execCommand('copy') // NOSONAR — legacy clipboard fallback for environments without navigator.clipboard
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [meeting.outputMd])

  const handleStatusChange = useCallback((id: string, status: string) => {
    setItemStatuses((prev) => ({ ...prev, [id]: status }))
  }, [])

  // Build markdown without the Action Items section
  const markdownWithoutActions = useMemo(() => {
    if (!meeting.outputMd) return ''
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

  // Derive title
  const meetingTitle = meeting.title || 'Meeting Results'
  const duration = meeting.durationSeconds ? `${Math.round(meeting.durationSeconds)}s` : null

  // Use backend items (correct IDs) when available, fall back to parsed
  const baseItems = backendItems || parsed.actionItems
  const actionItems = baseItems.map((ai) => ({
    ...ai,
    status: itemStatuses[ai.id] || (ai as any).status, // NOSONAR — ai may carry legacy status field not in ParsedActionItem type
  }))

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'hsl(var(--background))',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: BORDER_1PX_SOLID_HSL_VAR_BORDER,
          background: HSL_CARD,
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: HSL_FOREGROUND, margin: 0 }}>
            ✅ {meetingTitle}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            {duration && (
              <span style={{ fontSize: 12, color: HSL_MUTED_FOREGROUND }}>⏱ {duration}</span>
            )}
            {meeting.outputPath && (
              <span style={{ fontSize: 11, color: HSL_MUTED_FOREGROUND, opacity: 0.7 }}>
                💾 {meeting.outputPath.split('/').pop()}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close (Esc)"
          style={{
            background: 'hsl(var(--secondary))',
            border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
            borderRadius: 6,
            width: 32,
            height: 32,
            fontSize: 16,
            cursor: 'pointer',
            color: HSL_FOREGROUND,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* ── Action buttons bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 20px',
          borderBottom: BORDER_1PX_SOLID_HSL_VAR_BORDER,
          background: HSL_CARD,
          flexShrink: 0,
        }}
      >
        <Button variant="outline" size="sm" className="text-xs h-7" onClick={handleCopy}>
          {copied ? '✓ Copied' : '📋 Copy'}
        </Button>
        {onStartFollowUp && (
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={onStartFollowUp}>
            🔄 Follow-up
          </Button>
        )}
        {mode === 'dialog' && onOpenInSidebar && !onStartFollowUp && (
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={onOpenInSidebar}>
            📌 Sidebar
          </Button>
        )}
      </div>

      {/* ── Body: Menu + Content ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar menu */}
        <MeetingViewMenu
          activeView={activeView}
          onSelect={setActiveView}
          actionCount={actionItems.length}
          roundCount={meeting.rounds.length}
        />

        {/* Content area */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px 32px',
            background: 'hsl(var(--background))',
          }}
        >
          {(() => {
            if (!meeting.outputMd) {
              if (outputError) return (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 13, color: 'hsl(var(--destructive))', marginBottom: 12 }}>
                    ⚠️ {outputError}
                  </div>
                  {onRetryFetch && (
                    <Button variant="outline" size="sm" onClick={() => onRetryFetch()}>
                      🔄 Retry
                    </Button>
                  )}
                </div>
              )
              return (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 0',
                    color: HSL_MUTED_FOREGROUND,
                    fontSize: 13,
                  }}
                >
                  {outputLoading ? 'Loading output…' : 'No output available'}
                </div>
              )
            }
            if (activeView === 'structured') return (
              <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <MarkdownViewer content={markdownWithoutActions} className="text-sm" />
                {actionItems.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    <h2
                      style={{
                        fontSize: 20,
                        fontWeight: 600,
                        marginBottom: 12,
                        color: HSL_FOREGROUND,
                        borderBottom: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                        paddingBottom: 6,
                      }}
                    >
                      ✅ Action Items
                    </h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {actionItems.map((item) => (
                        <ActionItemCard
                          key={item.id}
                          item={item}
                          meetingId={meeting.meetingId}
                          projectId={meeting.project_id}
                          onStatusChange={handleStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
            if (activeView === 'actions') return (
              <ActionsView
                items={actionItems}
                meetingId={meeting.meetingId}
                projectId={meeting.project_id}
                onStatusChange={handleStatusChange}
              />
            )
            if (activeView === 'transcript') return (
              <TranscriptView rounds={meeting.rounds} />
            )
            return (
              <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <pre
                  style={{
                    fontSize: 12,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    color: HSL_FOREGROUND,
                    background: 'hsl(var(--secondary) / 0.3)',
                    padding: 16,
                    borderRadius: 8,
                    border: BORDER_1PX_SOLID_HSL_VAR_BORDER,
                    margin: 0,
                  }}
                >
                  {meeting.outputMd}
                </pre>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

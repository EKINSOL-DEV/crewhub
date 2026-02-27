/**
 * Zen Activity Detail Panel
 * Shows activity/task details when clicked in the Activity panel.
 * Matches Sessions detail panel pattern with Info and History tabs.
 */

import { useMemo, useState } from 'react'
import type { CrewSession } from '@/lib/api'
import type { ActiveTask } from '@/hooks/useActiveTasks'
import { FullscreenDetailView } from './FullscreenDetailView'
import { DetailPanelShell } from './DetailPanelShell'
import { SessionHistoryView } from '@/components/shared/SessionHistoryView'
import { useSessionHistory } from '@/components/shared/sessionHistoryUtils'
import { formatTimestamp, formatDuration, formatTokens, formatEventTime } from '@/lib/formatters'

interface ActivityEvent {
  id: string
  type: 'created' | 'updated' | 'removed' | 'status'
  timestamp: number
  sessionKey: string
  sessionName: string
  description: string
  icon: string
  details?: string
}

interface ZenActivityDetailPanelProps {
  readonly task: ActiveTask
  readonly session: CrewSession | null
  readonly events: ActivityEvent[]
  readonly onClose: () => void
}

function getStatusConfig(status: string): { color: string; label: string; dot: string } {
  switch (status) {
    case 'running':
      return { color: 'var(--zen-success)', label: 'Running', dot: '●' }
    case 'done':
      return { color: 'var(--zen-fg-dim)', label: 'Completed', dot: '✓' }
    case 'failed':
      return { color: 'var(--zen-error)', label: 'Failed', dot: '✕' }
    default:
      return { color: 'var(--zen-fg-muted)', label: status || 'Unknown', dot: '○' }
  }
}

function TimelineEvent({
  event,
  isOngoing,
}: Readonly<{ event: ActivityEvent; readonly isOngoing?: boolean }>) {
  const typeColors: Record<string, string> = {
    created: 'var(--zen-success)',
    updated: 'var(--zen-info)',
    removed: 'var(--zen-error)',
    status: 'var(--zen-warning)',
  }

  return (
    <div className={`zen-ad-timeline-event ${isOngoing ? 'zen-ad-timeline-ongoing' : ''}`}>
      <div className="zen-ad-timeline-time">{formatEventTime(event.timestamp)}</div>
      <div
        className="zen-ad-timeline-dot"
        style={{ background: typeColors[event.type] || 'var(--zen-fg-muted)' }}
      />
      <div className="zen-ad-timeline-content">
        <span className="zen-ad-timeline-icon">{event.icon}</span>
        <span className="zen-ad-timeline-desc">{event.description}</span>
        {event.details && <span className="zen-ad-timeline-details">{event.details}</span>}
      </div>
    </div>
  )
}

export function ZenActivityDetailPanel({
  task,
  session,
  events,
  onClose,
}: Readonly<ZenActivityDetailPanelProps>) {
  const [activeTab, setActiveTab] = useState<'info' | 'history'>('info')
  const [fullscreen, setFullscreen] = useState(false)

  const statusConfig = getStatusConfig(task.status)
  const { messages, loading, error, usageTotals } = useSessionHistory(
    task.sessionKey || undefined,
    200
  )

  const taskEvents = useMemo(() => {
    if (!task.sessionKey) return events.slice(0, 20)
    return events
      .filter((event) => event.sessionKey === task.sessionKey)
      .sort((a, b) => b.timestamp - a.timestamp)
  }, [events, task.sessionKey])

  const ongoingEvent = task.status === 'running' && taskEvents.length > 0 ? taskEvents[0] : null

  const historyTabLabel = messages.length > 0 ? `History (${messages.length})` : 'History'

  return (
    <>
      <DetailPanelShell
        panelClassName="zen-ad-panel"
        headerClassName="zen-ad-header"
        headerInfoClassName="zen-ad-header-info"
        headerInfo={
          <>
            <span className="zen-ad-header-icon">{task.agentIcon || '🤖'}</span>
            <span className="zen-ad-header-name">{task.title}</span>
            <span className="zen-ad-status-badge" style={{ color: statusConfig.color }}>
              {statusConfig.dot} {statusConfig.label}
            </span>
          </>
        }
        tabs={[
          { key: 'info', label: 'Info' },
          { key: 'history', label: historyTabLabel },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'info' | 'history')}
        onFullscreen={() => setFullscreen(true)}
        onClose={onClose}
      >
        {activeTab === 'info' && (
          <div className="zen-sd-meta">
            <div className="zen-sd-meta-grid">
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Title</span>
                <span className="zen-sd-meta-value">{task.title}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Status</span>
                <span className="zen-sd-meta-value" style={{ color: statusConfig.color }}>
                  {statusConfig.dot} {statusConfig.label}
                </span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Agent</span>
                <span className="zen-sd-meta-value">
                  {task.agentIcon} {task.agentName || '—'}
                </span>
              </div>
              {task.sessionKey && (
                <div className="zen-sd-meta-item">
                  <span className="zen-sd-meta-label">Session Key</span>
                  <span className="zen-sd-meta-value zen-sd-mono">{task.sessionKey}</span>
                </div>
              )}
              {session && (
                <>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Model</span>
                    <span className="zen-sd-meta-value">{session.model || '—'}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Channel</span>
                    <span className="zen-sd-meta-value">{session.channel || 'direct'}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Last Activity</span>
                    <span className="zen-sd-meta-value">{formatTimestamp(session.updatedAt)}</span>
                  </div>
                  <div className="zen-sd-meta-item">
                    <span className="zen-sd-meta-label">Duration</span>
                    <span className="zen-sd-meta-value">{formatDuration(session.updatedAt)}</span>
                  </div>
                </>
              )}
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Task ID</span>
                <span className="zen-sd-meta-value zen-sd-mono">{task.id}</span>
              </div>
              {task.doneAt && (
                <div className="zen-sd-meta-item">
                  <span className="zen-sd-meta-label">Completed At</span>
                  <span className="zen-sd-meta-value">{formatTimestamp(task.doneAt)}</span>
                </div>
              )}
            </div>

            {(session?.totalTokens || usageTotals.total > 0) && (
              <>
                <div className="zen-sd-section-title">Token Usage</div>
                <div className="zen-sd-meta-grid">
                  {session && (
                    <>
                      <div className="zen-sd-meta-item">
                        <span className="zen-sd-meta-label">Context</span>
                        <span className="zen-sd-meta-value">
                          {formatTokens(session.contextTokens)}
                        </span>
                      </div>
                      <div className="zen-sd-meta-item">
                        <span className="zen-sd-meta-label">Total (session)</span>
                        <span className="zen-sd-meta-value">
                          {formatTokens(session.totalTokens)}
                        </span>
                      </div>
                    </>
                  )}
                  {usageTotals.total > 0 && (
                    <>
                      <div className="zen-sd-meta-item">
                        <span className="zen-sd-meta-label">Input (history)</span>
                        <span className="zen-sd-meta-value">{formatTokens(usageTotals.input)}</span>
                      </div>
                      <div className="zen-sd-meta-item">
                        <span className="zen-sd-meta-label">Output (history)</span>
                        <span className="zen-sd-meta-value">
                          {formatTokens(usageTotals.output)}
                        </span>
                      </div>
                      {usageTotals.cost > 0 && (
                        <div className="zen-sd-meta-item">
                          <span className="zen-sd-meta-label">Cost</span>
                          <span className="zen-sd-meta-value">${usageTotals.cost.toFixed(4)}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

            {taskEvents.length > 0 && (
              <>
                <div className="zen-sd-section-title">Recent Events</div>
                <div className="zen-ad-events-mini">
                  {taskEvents.slice(0, 5).map((event) => (
                    <TimelineEvent
                      key={event.id}
                      event={event}
                      isOngoing={event === ongoingEvent}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="zen-sd-history">
            {task.status === 'running' && (
              <div className="zen-ad-ongoing-banner">
                <span className="zen-thinking-dots">
                  <span />
                  <span />
                  <span />
                </span>{' '}
                Task is actively running...
              </div>
            )}

            {taskEvents.length > 0 && (
              <div className="zen-ad-timeline-section">
                <div className="zen-ad-timeline-title">Activity Timeline</div>
                {taskEvents.map((event) => (
                  <TimelineEvent key={event.id} event={event} isOngoing={event === ongoingEvent} />
                ))}
              </div>
            )}

            {loading || error || messages.length > 0 ? (
              <SessionHistoryView
                messages={messages}
                loading={loading}
                error={error}
                loadingText="Loading session history..."
                showCopyButton={false}
                toolRoleLabel="🔧 Tool"
              />
            ) : (
              taskEvents.length === 0 && <div className="zen-sd-empty">No history available</div>
            )}
          </div>
        )}
      </DetailPanelShell>

      {fullscreen && (
        <FullscreenDetailView
          type="activity"
          task={task}
          session={session}
          events={events}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  )
}

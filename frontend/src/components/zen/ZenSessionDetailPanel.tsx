/**
 * Zen Session Detail Panel
 * Shows session metadata, history/transcript, and actions
 */

import { useState } from 'react'
import type { CrewSession } from '@/lib/api'
import { FullscreenDetailView } from './FullscreenDetailView'
import { DetailPanelShell } from './DetailPanelShell'
import { SessionHistoryView } from '@/components/shared/SessionHistoryView'
import { useSessionHistory } from '@/components/shared/sessionHistoryUtils'
import { formatTimestamp, formatTokens, formatDuration } from '@/lib/formatters'

interface ZenSessionDetailPanelProps {
  readonly session: CrewSession
  readonly onClose: () => void
}

export function ZenSessionDetailPanel({ session, onClose }: Readonly<ZenSessionDetailPanelProps>) {
  const [activeTab, setActiveTab] = useState<'meta' | 'history'>('meta')
  const [fullscreen, setFullscreen] = useState(false)

  const { messages, loading, error, usageTotals } = useSessionHistory(session.key, 200)

  const displayName =
    session.displayName || session.label || session.key.split(':').pop() || 'Agent'

  return (
    <>
      <DetailPanelShell
        panelClassName="zen-sd-panel"
        headerClassName="zen-sd-header"
        headerInfoClassName="zen-sd-header-info"
        headerInfo={
          <>
            <span className="zen-sd-header-name">{displayName}</span>
            <span className="zen-sd-header-key">{session.key}</span>
          </>
        }
        tabs={[
          { key: 'meta', label: 'Info' },
          { key: 'history', label: `History (${messages.length})` },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'meta' | 'history')}
        onFullscreen={() => setFullscreen(true)}
        onClose={onClose}
      >
        {activeTab === 'meta' && (
          <div className="zen-sd-meta">
            <div className="zen-sd-meta-grid">
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Session Key</span>
                <span className="zen-sd-meta-value zen-sd-mono">{session.key}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Model</span>
                <span className="zen-sd-meta-value">{session.model || '—'}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Channel</span>
                <span className="zen-sd-meta-value">{session.channel || 'direct'}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Kind</span>
                <span className="zen-sd-meta-value">{session.kind || '—'}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Last Activity</span>
                <span className="zen-sd-meta-value">{formatTimestamp(session.updatedAt)}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Runtime</span>
                <span className="zen-sd-meta-value">{formatDuration(session.updatedAt)}</span>
              </div>
            </div>

            <div className="zen-sd-section-title">Token Usage</div>
            <div className="zen-sd-meta-grid">
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Context</span>
                <span className="zen-sd-meta-value">{formatTokens(session.contextTokens)}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Total (session)</span>
                <span className="zen-sd-meta-value">{formatTokens(session.totalTokens)}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Input (history)</span>
                <span className="zen-sd-meta-value">{formatTokens(usageTotals.input)}</span>
              </div>
              <div className="zen-sd-meta-item">
                <span className="zen-sd-meta-label">Output (history)</span>
                <span className="zen-sd-meta-value">{formatTokens(usageTotals.output)}</span>
              </div>
              {usageTotals.cost > 0 && (
                <div className="zen-sd-meta-item">
                  <span className="zen-sd-meta-label">Cost</span>
                  <span className="zen-sd-meta-value">${usageTotals.cost.toFixed(4)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="zen-sd-history">
            <SessionHistoryView
              messages={messages}
              loading={loading}
              error={error}
              reverseOrder
              showCopyButton
              toolRoleLabel="🔧 Tool Result"
            />
          </div>
        )}
      </DetailPanelShell>

      {fullscreen && (
        <FullscreenDetailView
          type="session"
          session={session}
          onClose={() => setFullscreen(false)}
        />
      )}
    </>
  )
}

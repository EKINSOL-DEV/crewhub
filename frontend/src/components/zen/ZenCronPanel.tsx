/**
 * Zen Cron Panel
 * Compact cron jobs view with quick actions
 */

import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/lib/api'

// ── Types ────────────────────────────────────────────────────────

interface CronSchedule {
  kind: 'cron' | 'at' | 'every'
  expr?: string
  tz?: string
  atMs?: number
  everyMs?: number
}

interface CronState {
  lastRunAtMs?: number | null
  nextRunAtMs?: number | null
  lastStatus?: 'ok' | 'error' | null
  lastError?: string | null
}

interface CronJob {
  id: string
  name: string
  enabled: boolean
  schedule: CronSchedule
  state?: CronState
}

// ── Formatting Helpers ───────────────────────────────────────────

function formatSchedule(schedule: CronSchedule): string {
  switch (schedule.kind) {
    case 'cron': {
      const expr = schedule.expr || ''
      const parts = expr.split(' ')
      if (parts.length !== 5) return expr

      const [minute, hour, _dom, _month, dayOfWeek] = parts

      if (expr === '* * * * *') return 'Every min'
      if (minute.startsWith('*/')) {
        const n = parseInt(minute.slice(2), 10)
        if (hour === '*') return `Every ${n}m`
      }
      if (minute === '0' && hour === '*') return 'Hourly'
      if (minute !== '*' && hour !== '*' && dayOfWeek === '*') {
        return `${hour}:${minute.padStart(2, '0')}`
      }
      return expr
    }
    case 'at': {
      const date = new Date(schedule.atMs || 0)
      return date.toLocaleDateString()
    }
    case 'every': {
      const ms = schedule.everyMs || 0
      if (ms < 60_000) return `${Math.round(ms / 1000)}s`
      if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
      return `${(ms / 3_600_000).toFixed(1)}h`
    }
  }
}

function formatNextRun(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Never'
  const now = Date.now()
  const diff = timestamp - now

  if (diff < 0) return 'Overdue'
  if (diff < 60_000) return '< 1m'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}

// ── Cron Item Component ──────────────────────────────────────────

interface CronItemProps {
  readonly job: CronJob
  readonly onToggle: () => void
  readonly onRun: () => void
}

function CronItem({ job, onToggle, onRun }: CronItemProps) {
  const hasError = job.state?.lastStatus === 'error'
  const isEnabled = job.enabled
  let statusDotClass: string
  if (!isEnabled) {
    statusDotClass = 'zen-status-dot-idle'
  } else if (hasError) {
    statusDotClass = 'zen-status-dot-error'
  } else {
    statusDotClass = 'zen-status-dot-active'
  }

  return (
    <div
      className={`zen-cron-item ${!isEnabled ? 'zen-cron-item-disabled' : ''} ${hasError ? 'zen-cron-item-error' : ''}`}
    >
      <div className="zen-cron-status">
        <span className={`zen-status-dot ${statusDotClass}`} />
      </div>

      <div className="zen-cron-info">
        <div className="zen-cron-name">{job.name}</div>
        <div className="zen-cron-meta">
          <span className="zen-cron-schedule">
            {job.schedule.kind === 'cron' && '🔄'}
            {job.schedule.kind === 'at' && '📅'}
            {job.schedule.kind === 'every' && '⏱️'} {formatSchedule(job.schedule)}
          </span>
          <span className="zen-cron-next">Next: {formatNextRun(job.state?.nextRunAtMs)}</span>
        </div>
        {hasError && job.state?.lastError && (
          <div className="zen-cron-error" title={job.state.lastError}>
            ⚠️ {job.state.lastError.slice(0, 40)}...
          </div>
        )}
      </div>

      <div className="zen-cron-actions">
        <button
          type="button"
          className="zen-cron-action"
          onClick={(e) => {
            e.stopPropagation()
            onRun()
          }}
          title="Run now"
          disabled={!isEnabled}
          aria-label="Run job now"
        >
          ▶
        </button>
        <button
          type="button"
          className={`zen-cron-action ${isEnabled ? 'zen-cron-action-enabled' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          title={isEnabled ? 'Disable' : 'Enable'}
          aria-label={isEnabled ? 'Disable job' : 'Enable job'}
        >
          {isEnabled ? '⏸' : '▶️'}
        </button>
      </div>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="zen-cron-empty">
      <div className="zen-empty-icon">⏰</div>
      <div className="zen-empty-title">No cron jobs</div>
      <div className="zen-empty-subtitle">Scheduled jobs will appear here</div>
    </div>
  )
}

// ── Loading State ────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="zen-cron-loading">
      <div className="zen-thinking-dots">
        <span />
        <span />
        <span />
      </div>
      <span>Loading cron jobs...</span>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

const POLL_INTERVAL = 30000 // 30 seconds

export function ZenCronPanel() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDisabled, setShowDisabled] = useState(true)

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/cron/jobs`)
      if (!response.ok) {
        setJobs([])
        return
      }
      const data = await response.json()
      setJobs(data.jobs || [])
      setError(null)
    } catch {
      setJobs([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchJobs])

  const handleToggle = useCallback(
    async (job: CronJob) => {
      try {
        const endpoint = job.enabled ? 'disable' : 'enable'
        await fetch(`${API_BASE}/cron/jobs/${job.id}/${endpoint}`, { method: 'POST' })
        await fetchJobs()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to toggle job')
      }
    },
    [fetchJobs]
  )

  const handleRun = useCallback(
    async (job: CronJob) => {
      try {
        await fetch(`${API_BASE}/cron/jobs/${job.id}/run?force=true`, { method: 'POST' })
        await fetchJobs()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to run job')
      }
    },
    [fetchJobs]
  )

  // Filter and sort jobs
  const visibleJobs = jobs
    .filter((j) => showDisabled || j.enabled)
    .sort((a, b) => {
      // Enabled first
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      // Then by name
      return a.name.localeCompare(b.name)
    })

  const enabledCount = jobs.filter((j) => j.enabled).length
  const errorCount = jobs.filter((j) => j.enabled && j.state?.lastStatus === 'error').length

  // Loading state
  if (isLoading && jobs.length === 0) {
    return (
      <div className="zen-cron-panel">
        <LoadingState />
      </div>
    )
  }

  // Empty state
  if (jobs.length === 0) {
    return (
      <div className="zen-cron-panel">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="zen-cron-panel">
      {/* Header with filters */}
      <div className="zen-cron-header">
        <div className="zen-cron-stats">
          <span className={enabledCount > 0 ? '' : 'zen-cron-stats-dim'}>
            {enabledCount} active
          </span>
          {errorCount > 0 && <span className="zen-cron-stats-error">{errorCount} errored</span>}
        </div>
        <label className="zen-cron-toggle-label">
          <input
            type="checkbox"
            checked={showDisabled}
            onChange={(e) => setShowDisabled(e.target.checked)}
          />
          Show disabled
        </label>
      </div>

      {/* Error banner */}
      {error && <div className="zen-cron-error-banner">{error}</div>}

      {/* Job list */}
      <div className="zen-cron-list">
        {visibleJobs.map((job) => (
          <CronItem
            key={job.id}
            job={job}
            onToggle={() => handleToggle(job)}
            onRun={() => handleRun(job)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="zen-cron-footer">
        <span className="zen-cron-count">
          {visibleJobs.length} job{visibleJobs.length !== 1 ? 's' : ''}
        </span>
        <button type="button" className="zen-btn zen-btn-small" onClick={fetchJobs}>
          ↻ Refresh
        </button>
      </div>
    </div>
  )
}

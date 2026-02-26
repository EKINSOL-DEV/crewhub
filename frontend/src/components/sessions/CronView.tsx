import { useState, useEffect } from 'react'
import { SESSION_CONFIG } from '@/lib/sessionConfig'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clock,
  RefreshCw,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Timer,
  Zap,
  Calendar,
  Repeat,
} from 'lucide-react'

// --- Interfaces matching the actual API response ---

interface CronSchedule {
  kind: 'cron'
  expr: string
  tz?: string
}

interface AtSchedule {
  kind: 'at'
  atMs: number
}

interface EverySchedule {
  kind: 'every'
  everyMs: number
}

type Schedule = CronSchedule | AtSchedule | EverySchedule

interface CronPayload {
  kind: 'agentTurn' | 'systemEvent'
  message?: string
}

interface CronState {
  lastRunAtMs?: number | null
  nextRunAtMs?: number | null
  lastStatus?: 'ok' | 'error' | null
  lastDurationMs?: number | null
  lastError?: string | null
}

interface CronJob {
  id: string
  name: string
  enabled: boolean
  schedule: Schedule
  sessionTarget?: string
  payload?: CronPayload
  state?: CronState
}

// --- Derived display status ---

type DisplayStatus = 'active' | 'paused' | 'error'

function getDisplayStatus(job: CronJob): DisplayStatus {
  if (!job.enabled) return 'paused'
  if (job.state?.lastStatus === 'error') return 'error'
  return 'active'
}

// --- Formatting helpers ---

function formatSchedule(schedule: Schedule): string { // NOSONAR
  // NOSONAR: complexity from cron schedule rendering with multiple format branches
  switch (schedule.kind) {
    case 'cron': {
      const expr = schedule.expr
      const parts = expr.split(' ')
      if (parts.length !== 5) return expr

      const [minute, hour, _dom, _month, dayOfWeek] = parts

      // Common patterns
      if (expr === '* * * * *') return 'Every minute'
      if (minute.startsWith('*/')) {
        const n = Number.parseInt(minute.slice(2), 10)
        if (hour === '*') return `Every ${n} min`
      }
      if (minute === '0' && hour === '*') return 'Every hour'
      if (minute === '0' && hour === '0' && dayOfWeek === '*') return 'Daily at midnight'
      if (minute !== '*' && hour !== '*' && dayOfWeek === '*') {
        return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
      }
      if (minute !== '*' && hour !== '*' && dayOfWeek !== '*') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const dayName = days[Number.parseInt(dayOfWeek, 10)] ?? dayOfWeek
        return `${dayName} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
      }

      return expr + (schedule.tz ? ` (${schedule.tz})` : '')
    }

    case 'at': {
      const date = new Date(schedule.atMs)
      return `Once at ${date.toLocaleString()}`
    }

    case 'every': {
      const ms = schedule.everyMs
      if (ms < 60_000) return `Every ${Math.round(ms / 1000)}s`
      if (ms < 3_600_000) return `Every ${Math.round(ms / 60_000)} min`
      if (ms < 86_400_000) return `Every ${(ms / 3_600_000).toFixed(1).replace(/\.0$/, '')}h`
      return `Every ${(ms / 86_400_000).toFixed(1).replace(/\.0$/, '')}d`
    }
  }
}

function getScheduleIcon(kind: Schedule['kind']) {
  switch (kind) {
    case 'cron':
      return <Repeat className="h-3 w-3" />
    case 'at':
      return <Calendar className="h-3 w-3" />
    case 'every':
      return <Timer className="h-3 w-3" />
  }
}

function formatTime(timestamp: number | null | undefined): string {
  if (!timestamp) return 'Never'
  const date = new Date(timestamp)
  const now = new Date()
  const diff = timestamp - now.getTime()

  if (diff < 0) {
    const absDiff = Math.abs(diff)
    if (absDiff < 60_000) return 'Just now'
    if (absDiff < 3_600_000) return `${Math.floor(absDiff / 60_000)}m ago`
    if (absDiff < 86_400_000) return `${Math.floor(absDiff / 3_600_000)}h ago`
    return date.toLocaleDateString()
  }

  if (diff < 60_000) return 'In < 1m'
  if (diff < 3_600_000) return `In ${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `In ${Math.floor(diff / 3_600_000)}h`
  return date.toLocaleDateString()
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return ''
  if (ms < 1_000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}min`
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 1) + '…'
}

// --- Component ---

export function CronView() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/cron/jobs')
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
        setError(null)
      } else {
        setJobs([])
        setError(null)
      }
    } catch (err) {
      console.warn('Cron jobs API not available:', err)
      setJobs([])
      setError(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, SESSION_CONFIG.cronViewPollMs)
    return () => clearInterval(interval)
  }, [])

  // Sort: enabled first, then by name
  const sortedJobs = [...jobs].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  const activeCount = jobs.filter((j) => j.enabled).length
  const disabledCount = jobs.filter((j) => !j.enabled).length
  const errorCount = jobs.filter((j) => j.enabled && j.state?.lastStatus === 'error').length

  const getStatusIcon = (status: DisplayStatus) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: DisplayStatus) => {
    const variants: Record<DisplayStatus, 'default' | 'secondary' | 'destructive'> = {
      active: 'default',
      paused: 'secondary',
      error: 'destructive',
    }
    return <Badge variant={variants[status]}>{status}</Badge>
  }

  return (
    <div className="h-full flex flex-col view-gradient">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold text-foreground">Scheduled Jobs</h2>
              <p className="text-sm text-muted-foreground">
                {jobs.length > 0 ? (
                  <>
                    {activeCount} active{disabledCount > 0 && `, ${disabledCount} disabled`}
                    {errorCount > 0 && (
                      <span className="text-red-500 ml-1">({errorCount} errored)</span>
                    )}
                  </>
                ) : (
                  'Manage cron-based agent tasks'
                )}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchJobs}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchJobs}>
              Try Again
            </Button>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center p-8">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
              <Clock className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Scheduled Jobs</h3>
            <p className="text-muted-foreground max-w-md">
              Cron jobs will appear here when configured. Jobs can be scheduled via the OpenClaw CLI
              or API.
            </p>
            <div className="mt-6 p-4 rounded-lg bg-muted border border-border text-left">
              <p className="text-xs text-muted-foreground mb-2">Example CLI command:</p>
              <code className="text-xs text-primary font-mono">
                openclaw cron add "0 9 * * *" --task "Daily summary"
              </code>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {sortedJobs.map((job) => {
              const status = getDisplayStatus(job)
              const lastError = job.state?.lastError
              const duration = job.state?.lastDurationMs

              return (
                <div
                  key={job.id}
                  className={`p-4 rounded-lg bg-card border border-border hover:bg-muted/50 transition-colors ${
                    job.enabled ? '' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(status)}
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground">{job.name}</h3>

                        {/* Schedule + payload info */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {getScheduleIcon(job.schedule.kind)}
                            {formatSchedule(job.schedule)}
                          </span>
                          <span>Last: {formatTime(job.state?.lastRunAtMs)}</span>
                          <span>Next: {formatTime(job.state?.nextRunAtMs)}</span>
                          {duration != null && duration > 0 && (
                            <span className="flex items-center gap-1">
                              <Timer className="h-3 w-3" />
                              {formatDuration(duration)}
                            </span>
                          )}
                        </div>

                        {/* Payload & target badges */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {job.payload?.kind && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              <Zap className="h-2.5 w-2.5 mr-0.5" />
                              {job.payload.kind}
                            </Badge>
                          )}
                          {job.sessionTarget && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {job.sessionTarget}
                            </Badge>
                          )}
                        </div>

                        {/* Error message */}
                        {lastError && status === 'error' && (
                          <p className="mt-2 text-xs text-red-500 cursor-help" title={lastError}>
                            ⚠ {truncate(lastError, 80)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(status)}
                      <Button variant="ghost" size="sm">
                        {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

/**
 * Zen Logs Panel
 * System logs viewer with filtering and auto-scroll
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { sseManager } from '@/lib/sseManager'

// ── Types ────────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  source: string
  message: string
}

// ── Log Level Configuration ──────────────────────────────────────

const LEVEL_CONFIG: Record<LogLevel, { icon: string; color: string; label: string }> = {
  debug: { icon: '🔍', color: 'var(--zen-fg-muted)', label: 'DEBUG' },
  info: { icon: 'ℹ️', color: 'var(--zen-info)', label: 'INFO' },
  warn: { icon: '⚠️', color: 'var(--zen-warning)', label: 'WARN' },
  error: { icon: '❌', color: 'var(--zen-error)', label: 'ERROR' },
}

// ── Formatting Helpers ───────────────────────────────────────────

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

// ── Log Entry Component ──────────────────────────────────────────

interface LogEntryItemProps {
  readonly entry: LogEntry
}

function LogEntryItem({ entry }: Readonly<LogEntryItemProps>) {
  const config = LEVEL_CONFIG[entry.level]

  return (
    <div className={`zen-log-entry zen-log-level-${entry.level}`}>
      <span className="zen-log-time">{formatTime(entry.timestamp)}</span>
      <span className="zen-log-level" style={{ color: config.color }} title={config.label}>
        {config.icon}
      </span>
      <span className="zen-log-source">[{entry.source}]</span>
      <span className="zen-log-message">{entry.message}</span>
    </div>
  )
}

// ── Filter Controls ──────────────────────────────────────────────

interface FilterControlsProps {
  readonly levels: Set<LogLevel>
  readonly onToggleLevel: (level: LogLevel) => void
  readonly search: string
  readonly onSearchChange: (value: string) => void
  readonly autoScroll: boolean
  readonly onAutoScrollChange: (value: boolean) => void
}

function FilterControls({
  levels,
  onToggleLevel,
  search,
  onSearchChange,
  autoScroll,
  onAutoScrollChange,
}: Readonly<FilterControlsProps>) {
  return (
    <div className="zen-logs-filters">
      <input
        type="text"
        className="zen-logs-search"
        placeholder="Filter logs..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <div className="zen-logs-levels">
        {(Object.keys(LEVEL_CONFIG) as LogLevel[]).map((level) => {
          const config = LEVEL_CONFIG[level]
          const isActive = levels.has(level)

          return (
            <button
              type="button"
              key={level}
              className={`zen-logs-level-btn ${isActive ? 'zen-logs-level-active' : ''}`}
              onClick={() => onToggleLevel(level)}
              style={{
                borderColor: isActive ? config.color : 'transparent',
                color: isActive ? config.color : 'var(--zen-fg-muted)',
              }}
              title={`${isActive ? 'Hide' : 'Show'} ${config.label}`}
              aria-label={`${isActive ? 'Hide' : 'Show'} ${config.label} logs`}
            >
              {config.icon}
            </button>
          )
        })}
      </div>

      <label className="zen-logs-autoscroll">
        <input
          type="checkbox"
          checked={autoScroll}
          onChange={(e) => onAutoScrollChange(e.target.checked)}
        />{' '}
        Auto-scroll
      </label>
    </div>
  )
}

// ── Empty State ──────────────────────────────────────────────────

function EmptyState({ hasFilter }: Readonly<{ hasFilter: boolean }>) {
  return (
    <div className="zen-logs-empty">
      <div className="zen-empty-icon">📜</div>
      <div className="zen-empty-title">{hasFilter ? 'No matching logs' : 'No logs yet'}</div>
      <div className="zen-empty-subtitle">
        {hasFilter ? 'Try adjusting your filters' : 'System events will appear here'}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────

const MAX_LOGS = 500
const BATCH_DELAY_MS = 100

export function ZenLogsPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [levels, setLevels] = useState<Set<LogLevel>>(new Set(['info', 'warn', 'error']))
  const [search, setSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const batchedLogsRef = useRef<LogEntry[]>([])
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logIdRef = useRef(0)

  // Flush batched logs
  const flushBatch = useCallback(() => {
    if (batchedLogsRef.current.length === 0) return

    const newLogs = [...batchedLogsRef.current]
    batchedLogsRef.current = []

    setLogs((prev) => {
      const combined = [...newLogs, ...prev]
      return combined.slice(0, MAX_LOGS)
    })
  }, [])

  // Add log entry with batching
  const addLog = useCallback(
    (entry: Omit<LogEntry, 'id'>) => {
      batchedLogsRef.current.push({
        ...entry,
        id: `log-${++logIdRef.current}`,
      })

      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
      }

      batchTimeoutRef.current = setTimeout(flushBatch, BATCH_DELAY_MS)
    },
    [flushBatch]
  )

  // Subscribe to SSE events
  useEffect(() => {
    // Connection state
    const unsubState = sseManager.onStateChange((state) => {
      setConnected(state === 'connected')

      addLog({
        timestamp: Date.now(),
        level: state === 'connected' ? 'info' : 'warn',
        source: 'SSE',
        message:
          state === 'connected' ? 'Connected to event stream' : 'Disconnected - reconnecting...',
      })
    })

    // Session events
    const handleSessionCreated = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        addLog({
          timestamp: Date.now(),
          level: 'info',
          source: 'Session',
          message: `Created: ${data.label || data.key || 'Unknown'}`,
        })
      } catch {
        /* intentionally empty */
      }
    }

    const handleSessionUpdated = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        addLog({
          timestamp: Date.now(),
          level: 'debug',
          source: 'Session',
          message: `Updated: ${data.label || data.key || 'Unknown'}`,
        })
      } catch {
        /* intentionally empty */
      }
    }

    const handleSessionRemoved = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        addLog({
          timestamp: Date.now(),
          level: 'info',
          source: 'Session',
          message: `Removed: ${data.key || 'Unknown'}`,
        })
      } catch {
        /* intentionally empty */
      }
    }

    // Task events
    const handleTaskCreated = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        addLog({
          timestamp: Date.now(),
          level: 'info',
          source: 'Task',
          message: `Created: ${data.title || 'Untitled'}`,
        })
      } catch {
        /* intentionally empty */
      }
    }

    const handleTaskUpdated = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data)
        addLog({
          timestamp: Date.now(),
          level: 'debug',
          source: 'Task',
          message: `Updated: ${data.title || data.id || 'Unknown'}`,
        })
      } catch {
        /* intentionally empty */
      }
    }

    // Room events
    const handleRoomsRefresh = () => {
      addLog({
        timestamp: Date.now(),
        level: 'debug',
        source: 'Rooms',
        message: 'Rooms refreshed',
      })
    }

    const unsubCreated = sseManager.subscribe('session-created', handleSessionCreated)
    const unsubUpdated = sseManager.subscribe('session-updated', handleSessionUpdated)
    const unsubRemoved = sseManager.subscribe('session-removed', handleSessionRemoved)
    const unsubTaskCreated = sseManager.subscribe('task-created', handleTaskCreated)
    const unsubTaskUpdated = sseManager.subscribe('task-updated', handleTaskUpdated)
    const unsubRooms = sseManager.subscribe('rooms-refresh', handleRoomsRefresh)

    return () => {
      unsubState()
      unsubCreated()
      unsubUpdated()
      unsubRemoved()
      unsubTaskCreated()
      unsubTaskUpdated()
      unsubRooms()

      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current)
      }
    }
  }, [addLog])

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [logs, autoScroll])

  // Handle scroll
  const handleScroll = useCallback(() => {
    const list = listRef.current
    if (!list) return
    setAutoScroll(list.scrollTop < 50)
  }, [])

  // Toggle level filter
  const handleToggleLevel = useCallback((level: LogLevel) => {
    setLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) {
        next.delete(level)
      } else {
        next.add(level)
      }
      return next
    })
  }, [])

  // Clear logs
  const handleClear = useCallback(() => {
    setLogs([])
    batchedLogsRef.current = []
  }, [])

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (!levels.has(log.level)) return false
      if (
        search &&
        !log.message.toLowerCase().includes(search.toLowerCase()) &&
        !log.source.toLowerCase().includes(search.toLowerCase())
      )
        return false
      return true
    })
  }, [logs, levels, search])

  const hasFilter = search !== '' || levels.size < 4

  return (
    <div className="zen-logs-panel">
      {/* Filters */}
      <FilterControls
        levels={levels}
        onToggleLevel={handleToggleLevel}
        search={search}
        onSearchChange={setSearch}
        autoScroll={autoScroll}
        onAutoScrollChange={setAutoScroll}
      />

      {/* Connection status */}
      {!connected && (
        <div className="zen-logs-reconnecting">
          <span className="zen-thinking-dots">
            <span />
            <span />
            <span />
          </span>{' '}
          Reconnecting...
        </div>
      )}

      {/* Logs list */}
      {filteredLogs.length === 0 ? (
        <EmptyState hasFilter={hasFilter} />
      ) : (
        <div ref={listRef} className="zen-logs-list" onScroll={handleScroll}>
          {filteredLogs.map((entry) => (
            <LogEntryItem key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="zen-logs-footer">
        <span className="zen-logs-count">
          {filteredLogs.length} / {logs.length} entries
        </span>
        {logs.length > 0 && (
          <button type="button" className="zen-btn zen-btn-small" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

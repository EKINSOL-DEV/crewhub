/**
 * Context Envelope Inspector
 * Shows the context envelope that agents receive for a room.
 * Accessible from room focus panel.
 */
import { useState, useEffect, useCallback, useRef } from 'react'

interface ContextInspectorProps {
  readonly roomId: string
  readonly roomName: string
  readonly onClose: () => void
}

type PrivacyTier = 'crewhub-ui' | 'external'

interface EnvelopeResponse {
  envelope: Record<string, unknown>
  formatted: string
  channel: string
  privacy: string
}

export function ContextInspector({ roomId, roomName, onClose }: ContextInspectorProps) {
  // NOSONAR: complexity from legitimate 3D rendering pipeline; extracting would hurt readability
  const [data, setData] = useState<EnvelopeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<PrivacyTier>('crewhub-ui')
  const [viewMode, setViewMode] = useState<'tree' | 'json' | 'formatted'>('tree')
  const [copied, setCopied] = useState(false)
  const [prevEnvelope, setPrevEnvelope] = useState<Record<string, unknown> | null>(null)
  const prevRef = useRef<Record<string, unknown> | null>(null)

  const fetchContext = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(`/api/rooms/${roomId}/context?channel=${channel}`)
      if (!resp.ok) throw new Error(`Failed to fetch context: ${resp.status}`)
      const result: EnvelopeResponse = await resp.json()

      // Track previous for diff
      if (data?.envelope) {
        prevRef.current = data.envelope
        setPrevEnvelope(data.envelope)
      }

      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [roomId, channel])

  useEffect(() => {
    fetchContext()
    // Poll for updates every 10s
    const interval = setInterval(fetchContext, 10000)
    return () => clearInterval(interval)
  }, [fetchContext])

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        bottom: 80,
        width: 400,
        zIndex: 30,
        background: 'rgba(15, 17, 28, 0.95)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: 16,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        color: '#e2e8f0',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div
            style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span>🔍</span>
            <span>Context Inspector</span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{roomName}</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: 'none',
            borderRadius: 8,
            width: 32,
            height: 32,
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </div>

      {/* Controls */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Privacy tier toggle */}
        <div
          style={{
            display: 'flex',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {(['crewhub-ui', 'external'] as PrivacyTier[]).map((tier) => (
            <button
              key={tier}
              onClick={() => setChannel(tier)}
              style={{
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                background: channel === tier ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                color: channel === tier ? '#a5b4fc' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {tier === 'crewhub-ui' ? '🔒 Internal' : '🌐 External'}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div
          style={{
            display: 'flex',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.1)',
            marginLeft: 'auto',
          }}
        >
          {(['tree', 'json', 'formatted'] as const).map((mode) => {
            let modeIcon: string
            if (mode === 'formatted') {
              modeIcon = '📝'
            } else if (mode === 'json') {
              modeIcon = '{}'
            } else {
              modeIcon = '🌳'
            }
            return (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  background: viewMode === mode ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: viewMode === mode ? '#a5b4fc' : '#64748b',
                  transition: 'all 0.15s',
                  textTransform: 'capitalize',
                }}
              >
                {modeIcon} {mode}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {loading && !data ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            Loading context...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#ef4444' }}>
            {error}
            <br />
            <button
              onClick={fetchContext}
              style={{
                marginTop: 12,
                padding: '6px 16px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {/* Stats bar */}
            <div
              style={{
                display: 'flex',
                gap: 12,
                marginBottom: 16,
                flexWrap: 'wrap',
              }}
            >
              <StatBadge
                label="Privacy"
                value={data.privacy}
                color={data.privacy === 'internal' ? '#22c55e' : '#f59e0b'}
              />
              <StatBadge label="Version" value={String(data.envelope.context_version)} />
              <StatBadge
                label="Size"
                value={`${new Blob([JSON.stringify(data.envelope)]).size} B`}
              />
              {Array.isArray(data.envelope.tasks) && (
                <StatBadge label="Tasks" value={String(data.envelope.tasks.length)} />
              )}
              {Array.isArray(data.envelope.participants) && (
                <StatBadge label="Agents" value={String(data.envelope.participants.length)} />
              )}
            </div>

            {viewMode === 'tree' && <TreeView data={data.envelope} prevData={prevEnvelope} />}
            {viewMode === 'json' && (
              <pre
                style={{
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                  margin: 0,
                  color: '#cbd5e1',
                }}
              >
                {JSON.stringify(data.envelope, null, 2)}
              </pre>
            )}
            {viewMode === 'formatted' && (
              <pre
                style={{
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6,
                  margin: 0,
                  color: '#cbd5e1',
                }}
              >
                {data.formatted}
              </pre>
            )}
          </>
        ) : null}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          gap: 8,
        }}
      >
        <button
          onClick={() => data && handleCopy(JSON.stringify(data.envelope, null, 2))}
          disabled={!data}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: copied ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.04)',
            color: copied ? '#22c55e' : '#94a3b8',
            fontSize: 12,
            fontWeight: 500,
            cursor: data ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {copied ? '✅ Copied!' : '📋 Copy JSON'}
        </button>
        <button
          onClick={() => data && handleCopy(data.formatted)}
          disabled={!data}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: '#94a3b8',
            fontSize: 12,
            fontWeight: 500,
            cursor: data ? 'pointer' : 'not-allowed',
          }}
        >
          📝 Copy Formatted
        </button>
        <button
          onClick={fetchContext}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: '#94a3b8',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          🔄
        </button>
      </div>
    </div>
  )
}

// ── Stat Badge ──────────────────────────────────────────────────

function StatBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 10px',
        borderRadius: 6,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        fontSize: 11,
      }}
    >
      <span style={{ color: '#64748b' }}>{label}:</span>
      <span
        style={{
          color: color || '#a5b4fc',
          fontWeight: 500,
          fontFamily: 'JetBrains Mono, Menlo, monospace',
        }}
      >
        {value.length > 16 ? value.slice(-8) : value}
      </span>
    </div>
  )
}

// ── Tree View ───────────────────────────────────────────────────

function TreeView({
  data,
  prevData,
  depth = 0,
}: {
  data: unknown
  prevData?: unknown
  depth?: number
}) {
  if (data === null || data === undefined) {
    return <span style={{ color: '#64748b', fontStyle: 'italic' }}>null</span>
  }

  if (typeof data === 'boolean') {
    return <span style={{ color: '#f59e0b' }}>{String(data)}</span>
  }

  if (typeof data === 'number') {
    return <span style={{ color: '#22d3ee' }}>{data}</span>
  }

  if (typeof data === 'string') {
    return <span style={{ color: '#86efac' }}>"{data}"</span>
  }

  if (Array.isArray(data)) {
    return (
      <ArrayView
        items={data}
        prevItems={Array.isArray(prevData) ? prevData : undefined}
        depth={depth}
      />
    )
  }

  if (typeof data === 'object') {
    return (
      <ObjectView
        obj={data as Record<string, unknown>}
        prevObj={
          typeof prevData === 'object' && prevData
            ? (prevData as Record<string, unknown>)
            : undefined
        }
        depth={depth}
      />
    )
  }

  return <span style={{ color: '#94a3b8' }}>{String(data)}</span>
}

function ObjectView({
  obj,
  prevObj,
  depth,
}: {
  obj: Record<string, unknown>
  prevObj?: Record<string, unknown>
  depth: number
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const entries = Object.entries(obj)

  return (
    <div style={{ marginLeft: depth > 0 ? 16 : 0 }}>
      {entries.map(([key, value]) => {
        const isComplex = typeof value === 'object' && value !== null
        const isCollapsed = collapsed[key]
        const changed = prevObj && JSON.stringify(prevObj[key]) !== JSON.stringify(value)

        return (
          <div key={key} style={{ marginBottom: 2 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 4,
                padding: '2px 0',
                borderRadius: 4,
                background: changed ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
                transition: 'background 0.3s',
              }}
            >
              {isComplex && (
                <button
                  onClick={() => toggle(key)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: '2px 0',
                    width: 14,
                    flexShrink: 0,
                  }}
                >
                  {isCollapsed ? '▶' : '▼'}
                </button>
              )}
              {!isComplex && <span style={{ width: 14, flexShrink: 0 }} />}
              <span
                style={{
                  color: '#818cf8',
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                }}
              >
                {key}
              </span>
              <span style={{ color: '#475569', fontSize: 12 }}>:</span>
              {!isComplex && (
                <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, Menlo, monospace' }}>
                  <TreeView data={value} prevData={prevObj?.[key]} depth={depth + 1} />
                </span>
              )}
              {isComplex && isCollapsed && (
                <span style={{ color: '#475569', fontSize: 11 }}>
                  {Array.isArray(value)
                    ? `[${value.length}]`
                    : `{${Object.keys(value as object).length}}`}
                </span>
              )}
              {changed && <span style={{ color: '#fbbf24', fontSize: 10, marginLeft: 4 }}>●</span>}
            </div>
            {isComplex && !isCollapsed && (
              <TreeView data={value} prevData={prevObj?.[key]} depth={depth + 1} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ArrayView({
  items,
  prevItems,
  depth,
}: {
  items: unknown[]
  prevItems?: unknown[]
  depth: number
}) {
  const [collapsed, setCollapsed] = useState(items.length > 5)

  if (collapsed) {
    return (
      <span>
        <button
          onClick={() => setCollapsed(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: 11,
          }}
        >
          ▶ [{items.length} items]
        </button>
      </span>
    )
  }

  return (
    <div style={{ marginLeft: 16 }}>
      <button
        onClick={() => setCollapsed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          fontSize: 10,
          marginBottom: 2,
        }}
      >
        ▼
      </button>
      {items.map((item, i) => (
        <div key={`item-${i}`} style={{ marginBottom: 2 }}>
          <span style={{ color: '#475569', fontSize: 11, marginRight: 6 }}>{i}:</span>
          <TreeView data={item} prevData={prevItems?.[i]} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

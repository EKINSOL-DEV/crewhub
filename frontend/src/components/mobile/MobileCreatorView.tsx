/**
 * MobileCreatorView - Mobile-friendly Creator / Prop Maker view
 *
 * Provides a full-screen mobile UI for generating props:
 * - Text prompt → AI-generated 3D prop
 * - Generation history
 * - Desktop redirect note for 3D preview
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { ArrowLeft, Wand2, Clock, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface GenerationRecord {
  id: string
  prompt: string
  name: string
  model: string
  modelLabel: string
  method: string
  parts: unknown[]
  code: string
  createdAt: string
  error: string | null
}

interface ThinkingLine {
  text: string
  type: 'status' | 'thinking' | 'text' | 'tool' | 'tool_result' | 'correction' | 'complete' | 'error' | 'model' | 'prompt'
}

// ── Main Component ────────────────────────────────────────────────

interface MobileCreatorViewProps {
  onBack: () => void
}

export function MobileCreatorView({ onBack }: MobileCreatorViewProps) {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')

  return (
    <div style={{
      height: '100dvh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--mobile-bg, #0f172a)',
      color: 'var(--mobile-text, #e2e8f0)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
        background: 'var(--mobile-surface, #1e293b)',
        borderBottom: '1px solid var(--mobile-border, rgba(255,255,255,0.08))',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            width: 36, height: 36, borderRadius: 10,
            border: 'none', background: 'var(--mobile-surface2, rgba(255,255,255,0.06))',
            color: 'var(--mobile-text-muted, #94a3b8)',
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🎨</span>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--mobile-text, #f1f5f9)' }}>
            Creator
          </h1>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--mobile-border, rgba(255,255,255,0.08))',
        background: 'var(--mobile-surface, #1e293b)',
        flexShrink: 0,
      }}>
        {([
          { id: 'generate' as const, label: '⚡ Prop Maker' },
          { id: 'history' as const, label: '📋 History' },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '11px 8px',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? '#818cf8' : 'var(--mobile-text-muted, #94a3b8)',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #818cf8' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'generate' ? (
          <PropGeneratorTab />
        ) : (
          <PropHistoryTab />
        )}
      </div>
    </div>
  )
}

// ── Generator Tab ─────────────────────────────────────────────────

function PropGeneratorTab() {
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [thinkingLines, setThinkingLines] = useState<ThinkingLine[]>([])
  const [result, setResult] = useState<{ name: string; parts: unknown[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const [showThinking, setShowThinking] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const thinkingScrollRef = useRef<HTMLDivElement>(null)

  const examplePrompts = [
    'A glowing mushroom lamp',
    'A steampunk gear clock',
    'A floating crystal orb',
    'A retro arcade cabinet',
    'A neon "OPEN" sign',
    'A tiny robot figurine',
  ]

  // Cleanup on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close() }
  }, [])

  // Auto-scroll thinking
  useEffect(() => {
    if (thinkingScrollRef.current) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight
    }
  }, [thinkingLines])

  const handleGenerate = useCallback(async () => {
    const text = inputText.trim()
    if (!text || isGenerating) return

    eventSourceRef.current?.close()
    setIsGenerating(true)
    setError(null)
    setResult(null)
    setThinkingLines([])
    setShowThinking(true)

    const addLine = (line: ThinkingLine) =>
      setThinkingLines(prev => [...prev, line])

    try {
      const url = `/api/creator/generate-prop-stream?prompt=${encodeURIComponent(text)}&model=sonnet-4-5`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.addEventListener('status', (e) =>
        addLine({ text: JSON.parse(e.data).message, type: 'status' }))
      es.addEventListener('model', (e) => {
        const d = JSON.parse(e.data)
        addLine({ text: `🎯 Model: ${d.modelLabel}`, type: 'model' })
      })
      es.addEventListener('thinking', (e) =>
        addLine({ text: `💭 ${JSON.parse(e.data).text}`, type: 'thinking' }))
      es.addEventListener('text', (e) =>
        addLine({ text: `📝 ${JSON.parse(e.data).text}`, type: 'text' }))
      es.addEventListener('tool', (e) =>
        addLine({ text: JSON.parse(e.data).message, type: 'tool' }))
      es.addEventListener('tool_result', (e) =>
        addLine({ text: JSON.parse(e.data).message, type: 'tool_result' }))
      es.addEventListener('correction', (e) =>
        addLine({ text: JSON.parse(e.data).message, type: 'correction' }))

      es.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data)
        es.close()
        eventSourceRef.current = null
        addLine({ text: '✅ Prop generated successfully!', type: 'complete' })
        if (data.parts?.length) {
          setResult({ name: data.name, parts: data.parts })
        } else {
          setError('Generated prop has no geometry parts')
        }
        setIsGenerating(false)
        setInputText('')
      })

      es.addEventListener('error', (e) => {
        if (e instanceof MessageEvent) {
          try {
            const data = JSON.parse(e.data)
            addLine({ text: `❌ ${data.message}`, type: 'error' })
            setError(data.message)
          } catch {
            setError('Connection error')
          }
        } else {
          setError('Connection to server lost')
        }
        es.close()
        eventSourceRef.current = null
        setIsGenerating(false)
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setIsGenerating(false)
    }
  }, [inputText, isGenerating])

  const getLineColor = (line: ThinkingLine, isLast: boolean) => {
    if (line.type === 'error') return '#ef4444'
    if (line.type === 'complete') return '#22c55e'
    if (line.type === 'correction') return '#f59e0b'
    if (line.type === 'tool' || line.type === 'tool_result') return '#eab308'
    if (line.type === 'thinking') return isLast ? '#818cf8' : '#64748b'
    if (isLast) return '#818cf8'
    return '#64748b'
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Desktop hint banner */}
      <div style={{
        padding: '10px 14px',
        background: 'rgba(99,102,241,0.1)',
        border: '1px solid rgba(99,102,241,0.25)',
        borderRadius: 10,
        fontSize: 12,
        color: '#a5b4fc',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}>
        <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Generate 3D props with AI. For the full experience with live 3D preview and part editor, open CrewHub on desktop.
        </span>
      </div>

      {/* Examples toggle */}
      <div>
        <button
          onClick={() => setShowExamples(!showExamples)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none',
            color: '#94a3b8', fontSize: 13, cursor: 'pointer', padding: 0,
          }}
        >
          {showExamples ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Example prompts
        </button>
        {showExamples && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10,
          }}>
            {examplePrompts.map(p => (
              <button
                key={p}
                onClick={() => { setInputText(p); setShowExamples(false) }}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, color: '#cbd5e1',
                  fontSize: 12, cursor: 'pointer',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          placeholder="e.g. A glowing mushroom lamp with bioluminescent spots..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          disabled={isGenerating}
          rows={3}
          style={{
            width: '100%',
            padding: '12px 14px',
            background: 'var(--mobile-surface, #1e293b)',
            border: '1px solid var(--mobile-border, rgba(255,255,255,0.1))',
            borderRadius: 12,
            color: 'var(--mobile-text, #e2e8f0)',
            fontSize: 14,
            resize: 'none',
            outline: 'none',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !inputText.trim()}
          style={{
            padding: '13px 20px',
            background: isGenerating || !inputText.trim()
              ? 'rgba(99,102,241,0.3)'
              : 'linear-gradient(135deg, #6366f1, #818cf8)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: isGenerating || !inputText.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
        >
          <Wand2 size={18} />
          {isGenerating ? 'Generating...' : '⚡ Create Prop'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 14px',
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 10, color: '#fca5a5', fontSize: 13,
        }}>
          ❌ {error}
        </div>
      )}

      {/* Success result */}
      {result && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.25)',
          borderRadius: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 20 }}>🎉</span>
            <span style={{ fontWeight: 600, color: '#86efac', fontSize: 15 }}>{result.name}</span>
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            {(result.parts as unknown[]).length} part{(result.parts as unknown[]).length !== 1 ? 's' : ''} generated • Prop saved to library
          </div>
          <div style={{
            marginTop: 10, padding: '8px 12px',
            background: 'rgba(99,102,241,0.1)',
            borderRadius: 8, fontSize: 12, color: '#a5b4fc',
          }}>
            💡 Open CrewHub on desktop to view and place this prop in 3D
          </div>
        </div>
      )}

      {/* AI Thinking panel */}
      {thinkingLines.length > 0 && (
        <div style={{
          background: 'var(--mobile-surface, #1e293b)',
          border: '1px solid var(--mobile-border, rgba(255,255,255,0.08))',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowThinking(!showThinking)}
            style={{
              width: '100%', padding: '10px 14px',
              background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              color: '#94a3b8', fontSize: 13, cursor: 'pointer',
            }}
          >
            <span>🧠 AI Thinking Process {isGenerating ? '⏳' : ''}</span>
            {showThinking ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showThinking && (
            <div
              ref={thinkingScrollRef}
              style={{
                maxHeight: 200, overflowY: 'auto',
                padding: '0 14px 12px',
                fontSize: 11, lineHeight: 1.6,
              }}
            >
              {thinkingLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    color: getLineColor(line, i === thinkingLines.length - 1),
                    paddingLeft: line.type === 'thinking' ? 12 : 0,
                  }}
                >
                  {line.text}
                </div>
              ))}
              {isGenerating && (
                <div style={{ color: '#818cf8', animation: 'blink 1s step-end infinite' }}>▍</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── History Tab ───────────────────────────────────────────────────

function PropHistoryTab() {
  const [records, setRecords] = useState<GenerationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/creator/generation-history?limit=30')
      .then(r => r.json())
      .then(data => { setRecords(data.records || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#64748b', fontSize: 14,
      }}>
        Loading history...
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12, color: '#64748b', padding: 32,
      }}>
        <Clock size={36} style={{ opacity: 0.3 }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>No props yet</div>
          <div style={{ fontSize: 13 }}>Generate your first prop to see it here</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {records.map(record => {
        const isExpanded = expandedId === record.id
        const methodIcon = record.error ? '❌' : record.method === 'ai' ? '🤖' : '📐'
        const date = new Date(record.createdAt)
        const dateStr = date.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' })
        const timeStr = date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })

        return (
          <div
            key={record.id}
            style={{
              background: 'var(--mobile-surface, #1e293b)',
              border: `1px solid ${isExpanded ? 'rgba(99,102,241,0.35)' : 'var(--mobile-border, rgba(255,255,255,0.06))'}`,
              borderRadius: 12,
              overflow: 'hidden',
              transition: 'border-color 0.15s',
            }}
          >
            {/* Row */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : record.id)}
              style={{
                width: '100%', padding: '12px 14px',
                background: 'transparent', border: 'none',
                display: 'flex', alignItems: 'center', gap: 10,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{methodIcon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600,
                  color: record.error ? '#fca5a5' : 'var(--mobile-text, #e2e8f0)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {record.name || record.prompt}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {record.modelLabel} · {dateStr} {timeStr}
                </div>
              </div>
              <div style={{ flexShrink: 0, color: '#64748b' }}>
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div style={{
                padding: '0 14px 14px',
                borderTop: '1px solid var(--mobile-border, rgba(255,255,255,0.06))',
                paddingTop: 12,
              }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                  <span style={{ color: '#64748b' }}>Prompt: </span>
                  {record.prompt}
                </div>
                {record.parts && record.parts.length > 0 && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {record.parts.length} geometry part{record.parts.length !== 1 ? 's' : ''}
                  </div>
                )}
                {record.error && (
                  <div style={{
                    fontSize: 12, color: '#fca5a5',
                    background: 'rgba(239,68,68,0.08)',
                    padding: '6px 10px', borderRadius: 6, marginTop: 6,
                  }}>
                    Error: {record.error}
                  </div>
                )}
                <div style={{
                  marginTop: 10, padding: '8px 10px',
                  background: 'rgba(99,102,241,0.08)',
                  borderRadius: 8, fontSize: 11, color: '#818cf8',
                }}>
                  💻 Open desktop to view 3D preview & place in world
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

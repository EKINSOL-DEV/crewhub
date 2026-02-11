/**
 * Fullscreen Prop Maker View
 * Split-pane overlay: Left 50% (controls + think process), Right 50% (3D preview)
 */

import { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { DynamicProp, type PropPart } from './DynamicProp'
import React from 'react'

// ── Types ─────────────────────────────────────────────────────

interface ModelOption {
  key: string
  id: string
  label: string
  provider: string
}

interface ThinkingLine {
  text: string
  type: 'status' | 'thinking' | 'text' | 'tool' | 'tool_result' | 'correction' | 'complete' | 'error' | 'model' | 'prompt'
}

interface GenerationRecord {
  id: string
  prompt: string
  name: string
  model: string
  modelLabel: string
  method: string
  fullPrompt: string
  toolCalls: { name: string; input: string }[]
  corrections: string[]
  diagnostics: string[]
  parts: PropPart[]
  code: string
  createdAt: string
  error: string | null
}

type TabId = 'generate' | 'history'

interface FullscreenPropMakerProps {
  onClose: () => void
  onPropGenerated?: (prop: { name: string; filename: string; parts: PropPart[]; timestamp: number }) => void
}

// ── Error Boundary ────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class PropErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error): void {
    this.props.onError(error)
  }
  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

// ── Main Component ────────────────────────────────────────────

export function FullscreenPropMaker({ onClose, onPropGenerated }: FullscreenPropMakerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('generate')
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(false)

  // Model selection
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState('sonnet-4-5')

  // Preview state
  const [previewParts, setPreviewParts] = useState<PropPart[] | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewFilename, setPreviewFilename] = useState('')
  const [previewCode, setPreviewCode] = useState('')
  const [previewMethod, setPreviewMethod] = useState<'ai' | 'template'>('template')
  const [previewModelLabel, setPreviewModelLabel] = useState('')
  const [renderError, setRenderError] = useState<string | null>(null)
  const [lastPrompt, setLastPrompt] = useState('')
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  // AI thinking
  const [thinkingLines, setThinkingLines] = useState<ThinkingLine[]>([])
  const [fullPrompt, setFullPrompt] = useState<string | null>(null)
  const [toolCalls, setToolCalls] = useState<{ name: string; input: string }[]>([])
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

  // Load models
  useEffect(() => {
    fetch('/api/creator/models')
      .then(r => r.json())
      .then(data => {
        if (data.models) {
          setModels(data.models)
          setSelectedModel(data.default || 'sonnet-4-5')
        }
      })
      .catch(() => {
        setModels([
          { key: 'opus-4-6', id: 'anthropic/claude-opus-4-6', label: 'Opus 4-6', provider: 'anthropic' },
          { key: 'sonnet-4-5', id: 'anthropic/claude-sonnet-4-5', label: 'Sonnet 4.5', provider: 'anthropic' },
          { key: 'gpt-5-2', id: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'openai' },
        ])
      })
  }, [])

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll + disable canvas pointer events
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const canvases = document.querySelectorAll('canvas')
    const prevPE: string[] = []
    canvases.forEach((c, i) => { prevPE[i] = c.style.pointerEvents; c.style.pointerEvents = 'none' })
    window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: true } }))
    return () => {
      document.body.style.overflow = prev
      canvases.forEach((c, i) => { c.style.pointerEvents = prevPE[i] })
      window.dispatchEvent(new CustomEvent('fullscreen-overlay', { detail: { open: false } }))
    }
  }, [])

  // Cleanup EventSource
  useEffect(() => {
    return () => { eventSourceRef.current?.close() }
  }, [])

  // Auto-scroll thinking panel
  useEffect(() => {
    if (thinkingScrollRef.current) {
      thinkingScrollRef.current.scrollTop = thinkingScrollRef.current.scrollHeight
    }
  }, [thinkingLines])

  const handleGenerate = useCallback(async (prompt?: string) => {
    const text = (prompt || inputText).trim()
    if (!text || isGenerating) return

    eventSourceRef.current?.close()
    eventSourceRef.current = null

    setIsGenerating(true)
    setError(null)
    setSuccessMessage(null)
    setRenderError(null)
    setPreviewParts(null)
    setThinkingLines([])
    setFullPrompt(null)
    setToolCalls([])
    setLastPrompt(text)
    setInputText('')

    const addLine = (line: ThinkingLine) => {
      setThinkingLines(prev => [...prev, line])
    }

    try {
      const url = `/api/creator/generate-prop-stream?prompt=${encodeURIComponent(text)}&model=${encodeURIComponent(selectedModel)}`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.addEventListener('status', (e) => {
        addLine({ text: JSON.parse(e.data).message, type: 'status' })
      })
      es.addEventListener('model', (e) => {
        const data = JSON.parse(e.data)
        addLine({ text: `🎯 Model: ${data.modelLabel}`, type: 'model' })
        setPreviewModelLabel(data.modelLabel)
      })
      es.addEventListener('full_prompt', (e) => {
        const data = JSON.parse(e.data)
        setFullPrompt(data.prompt)
        addLine({ text: `📜 Full prompt loaded (${data.prompt.length} chars)`, type: 'prompt' })
      })
      es.addEventListener('thinking', (e) => {
        addLine({ text: `💭 ${JSON.parse(e.data).text}`, type: 'thinking' })
      })
      es.addEventListener('text', (e) => {
        addLine({ text: `📝 ${JSON.parse(e.data).text}`, type: 'text' })
      })
      es.addEventListener('tool', (e) => {
        const data = JSON.parse(e.data)
        setToolCalls(prev => [...prev, { name: data.name, input: data.input || '' }])
        addLine({ text: data.message, type: 'tool' })
      })
      es.addEventListener('tool_result', (e) => {
        addLine({ text: JSON.parse(e.data).message, type: 'tool_result' })
      })
      es.addEventListener('correction', (e) => {
        addLine({ text: JSON.parse(e.data).message, type: 'correction' })
      })
      es.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data)
        es.close()
        eventSourceRef.current = null
        addLine({ text: '✅ Prop generated successfully!', type: 'complete' })

        if (!data.parts || !Array.isArray(data.parts) || data.parts.length === 0) {
          setError('Generated prop has no geometry parts')
          setIsGenerating(false)
          return
        }

        setPreviewParts(data.parts)
        setPreviewName(data.name)
        setPreviewFilename(data.filename)
        setPreviewCode(data.code || '')
        setPreviewMethod(data.method || 'template')
        setPreviewModelLabel(data.modelLabel || '')
        setIsGenerating(false)
        setHistoryRefreshKey(k => k + 1)
      })
      es.addEventListener('error', (e) => {
        if (e instanceof MessageEvent) {
          try {
            const data = JSON.parse(e.data)
            addLine({ text: `❌ ${data.message}`, type: 'error' })
            setError(data.message)
          } catch {
            addLine({ text: '❌ Connection error', type: 'error' })
            setError('Connection error')
          }
        } else {
          addLine({ text: '❌ Connection lost', type: 'error' })
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
  }, [inputText, isGenerating, selectedModel])

  const handleApprove = useCallback(async () => {
    if (!previewParts || !previewName || isSaving) return
    setIsSaving(true)
    setError(null)
    const kebabName = previewName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()

    try {
      const res = await fetch('/api/creator/save-prop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: previewName, propId: kebabName, code: previewCode,
          parts: previewParts, mountType: 'floor', yOffset: 0.16,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || 'Save failed')
      }

      setSuccessMessage(`✅ "${previewName}" saved!`)
      onPropGenerated?.({
        name: previewName, filename: previewFilename,
        parts: previewParts, timestamp: Date.now(),
      })

      setTimeout(() => {
        setPreviewParts(null)
        setPreviewName('')
        setSuccessMessage(null)
      }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [previewParts, previewName, previewFilename, previewCode, isSaving, onPropGenerated])

  const handleRegenerate = useCallback(() => {
    if (lastPrompt) handleGenerate(lastPrompt)
  }, [lastPrompt, handleGenerate])

  const handleRetry = useCallback(() => {
    setRenderError(null)
    setError(null)
    if (lastPrompt) handleGenerate(lastPrompt)
  }, [lastPrompt, handleGenerate])

  const handleLoadFromHistory = useCallback((record: GenerationRecord) => {
    setPreviewParts(record.parts)
    setPreviewName(record.name)
    setPreviewFilename(`${record.name}.tsx`)
    setPreviewCode(record.code)
    setPreviewMethod(record.method as 'ai' | 'template')
    setPreviewModelLabel(record.modelLabel)
    setLastPrompt(record.prompt)
    setActiveTab('generate')
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  const handleRuntimeError = useCallback((error: Error) => {
    setRenderError(error.message)
  }, [])

  const getLineColor = (line: ThinkingLine, isLast: boolean) => {
    if (line.type === 'error') return 'var(--zen-error, #ef4444)'
    if (line.type === 'complete') return 'var(--zen-success, #22c55e)'
    if (line.type === 'correction') return '#f59e0b'
    if (line.type === 'tool' || line.type === 'tool_result') return '#eab308'
    if (line.type === 'thinking') return isLast ? 'var(--zen-accent, #6366f1)' : 'var(--zen-fg-dim, #888)'
    if (isLast) return 'var(--zen-accent, #6366f1)'
    return 'var(--zen-fg-dim, #888)'
  }

  const PreviewWrapper = useMemo(() => {
    if (!previewParts) return null
    const parts = previewParts
    return () => <DynamicProp parts={parts} position={[0, 0, 0]} scale={3} />
  }, [previewParts])

  const canPreview = PreviewWrapper && !renderError

  const overlay = (
    <div className="fpm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* Top bar */}
      <div className="fpm-topbar">
        <div className="fpm-topbar-left">
          <span className="fpm-topbar-icon">🔧</span>
          <span className="fpm-topbar-title">Prop Maker</span>
          {isGenerating && (
            <span className="fpm-topbar-status" style={{ color: '#eab308' }}>
              ⚙️ Generating...
            </span>
          )}
          {successMessage && (
            <span className="fpm-topbar-status" style={{ color: 'var(--zen-success, #22c55e)' }}>
              {successMessage}
            </span>
          )}
        </div>
        <button className="fpm-close" onClick={onClose} title="Close (Esc)">✕</button>
      </div>

      {/* Split view */}
      <div className="fpm-split">
        {/* Left side: Controls + Think process */}
        <div className="fpm-left">
          {/* Top: Controls */}
          <div className="fpm-controls">
            <div className="fpm-controls-scroll">
              {/* Tabs */}
              <div className="fpm-tabs">
                <button
                  className={`fpm-tab ${activeTab === 'generate' ? 'fpm-tab-active' : ''}`}
                  onClick={() => setActiveTab('generate')}
                >
                  ⚡ Generate
                </button>
                <button
                  className={`fpm-tab ${activeTab === 'history' ? 'fpm-tab-active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  📋 History
                </button>
              </div>

              {activeTab === 'generate' && (
                <>
                  <p className="fpm-description">
                    Describe the prop you want. The AI fabricator will generate a 3D object.
                  </p>

                  {/* Model chooser */}
                  <div className="fpm-model-row">
                    <label className="fpm-label">Model:</label>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      disabled={isGenerating}
                      className="fpm-select"
                    >
                      {models.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} ({m.provider})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Examples */}
                  <div className="fpm-examples-section">
                    <button
                      className="fpm-examples-toggle"
                      onClick={() => setShowExamples(!showExamples)}
                    >
                      {showExamples ? 'Hide examples ▴' : 'Show examples ▾'}
                    </button>
                    {showExamples && (
                      <div className="fpm-examples-grid">
                        {examplePrompts.map((p) => (
                          <button
                            key={p}
                            className="fpm-example-btn"
                            onClick={() => { setInputText(p); setShowExamples(false) }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <textarea
                    className="fpm-textarea"
                    placeholder="e.g. A glowing mushroom lamp with bioluminescent spots..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isGenerating}
                    rows={3}
                  />
                  <button
                    className="fpm-create-btn"
                    onClick={() => handleGenerate()}
                    disabled={isGenerating || !inputText.trim()}
                  >
                    {isGenerating ? '⏳ Generating...' : '⚡ Create'}
                  </button>

                  {/* Error */}
                  {error && !isGenerating && !previewParts && (
                    <div className="fpm-error">
                      ❌ {error}
                      <button className="fpm-retry-btn" onClick={handleRetry}>🔄 Retry</button>
                    </div>
                  )}

                  {/* Method badge */}
                  {previewParts && (
                    <div className="fpm-badges">
                      <span className={`fpm-badge fpm-badge-${previewMethod}`}>
                        {previewMethod === 'ai' ? '🤖 AI' : '📐 Template'}
                      </span>
                      {previewModelLabel && (
                        <span className="fpm-badge fpm-badge-model">{previewModelLabel}</span>
                      )}
                    </div>
                  )}

                  {/* Approve/Regenerate buttons when preview available */}
                  {previewParts && !isGenerating && (
                    <div className="fpm-action-row">
                      <button
                        className="fpm-approve-btn"
                        onClick={handleApprove}
                        disabled={isSaving || !!renderError}
                      >
                        {isSaving ? '💾 Saving...' : '✅ Approve & Save'}
                      </button>
                      <button className="fpm-regen-btn" onClick={handleRegenerate}>
                        🔄 Regenerate
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <HistoryPanel onLoadProp={handleLoadFromHistory} refreshKey={historyRefreshKey} />
              )}
            </div>
          </div>

          {/* Bottom: Think process */}
          <div className="fpm-thinking">
            <div className="fpm-thinking-header">
              🧠 AI Thinking Process
              {thinkingLines.some(l => l.type === 'thinking') && (
                <span className="fpm-live-badge">LIVE</span>
              )}
            </div>

            {/* Expandable sections */}
            <div className="fpm-thinking-toggles">
              {fullPrompt && (
                <ExpandableSection label="📜 Full Prompt" content={fullPrompt} />
              )}
              {toolCalls.length > 0 && (
                <ExpandableSection
                  label={`🔧 Tool Calls (${toolCalls.length})`}
                  content={toolCalls.map(tc => `${tc.name}: ${tc.input}`).join('\n')}
                  color="#eab308"
                />
              )}
            </div>

            <div className="fpm-thinking-log" ref={thinkingScrollRef}>
              {thinkingLines.length === 0 && !isGenerating && (
                <div className="fpm-thinking-empty">
                  Thinking process will appear here during generation...
                </div>
              )}
              {thinkingLines.map((line, i) => (
                <div
                  key={i}
                  className={`fpm-thinking-line ${line.type === 'thinking' ? 'fpm-thinking-indent' : ''}`}
                  style={{ color: getLineColor(line, i === thinkingLines.length - 1) }}
                >
                  {line.text}
                </div>
              ))}
              {isGenerating && (
                <div className="fpm-cursor">▍</div>
              )}
            </div>
          </div>
        </div>

        {/* Right side: 3D Preview */}
        <div className="fpm-right">
          {isGenerating ? (
            <div className="fpm-preview-placeholder">
              <div className="fpm-preview-spinner">⚙️</div>
              <div>Generating prop...</div>
              <div className="fpm-preview-sublabel">
                {previewModelLabel || selectedModel}
              </div>
            </div>
          ) : canPreview && PreviewWrapper ? (
            <Canvas camera={{ position: [3, 2, 3], fov: 45 }}>
              <PropErrorBoundary onError={handleRuntimeError}>
                <Suspense fallback={null}>
                  <Stage adjustCamera={false} environment="city" intensity={0.5}>
                    <PreviewWrapper />
                  </Stage>
                </Suspense>
              </PropErrorBoundary>
              <OrbitControls makeDefault enablePan enableZoom minDistance={1} maxDistance={15} />
              <ambientLight intensity={0.4} />
              <directionalLight position={[5, 5, 5]} intensity={0.8} />
            </Canvas>
          ) : renderError ? (
            <div className="fpm-preview-placeholder">
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div>Render failed</div>
              <div className="fpm-preview-error">{renderError}</div>
              <button className="fpm-retry-btn" onClick={handleRetry}>🔄 Retry</button>
            </div>
          ) : (
            <div className="fpm-preview-placeholder">
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.3 }}>🎨</div>
              <div>No model yet</div>
              <div className="fpm-preview-sublabel">
                Generate a prop to see the 3D preview here
              </div>
            </div>
          )}

          {/* Preview name overlay */}
          {previewName && !isGenerating && (
            <div className="fpm-preview-name">
              🔍 {previewName}
            </div>
          )}
        </div>
      </div>

      <style>{fullscreenPropMakerStyles}</style>
    </div>
  )

  return createPortal(overlay, document.body)
}

// ── Expandable Section ────────────────────────────────────────

function ExpandableSection({ label, content, color }: { label: string; content: string; color?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        className="fpm-expand-btn"
        style={color ? { color, borderColor: `${color}33` } : undefined}
        onClick={() => setOpen(!open)}
      >
        {label} {open ? '▴' : '▾'}
      </button>
      {open && (
        <pre className="fpm-expand-content">{content}</pre>
      )}
    </div>
  )
}

// ── History Panel ─────────────────────────────────────────────

function HistoryPanel({
  onLoadProp,
  refreshKey = 0,
}: {
  onLoadProp: (record: GenerationRecord) => void
  refreshKey?: number
}) {
  const [records, setRecords] = useState<GenerationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<GenerationRecord | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch('/api/creator/generation-history?limit=50')
      .then(r => r.json())
      .then(data => { setRecords(data.records || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [refreshKey])

  const handleSelect = (record: GenerationRecord) => {
    if (selectedId === record.id) {
      setSelectedId(null)
      setDetail(null)
    } else {
      setSelectedId(record.id)
      setDetail(record)
    }
  }

  if (loading) return <div className="fpm-history-empty">Loading history...</div>
  if (records.length === 0) return <div className="fpm-history-empty">No generations yet</div>

  return (
    <div className="fpm-history">
      <div className="fpm-history-list">
        {records.map((r) => (
          <div
            key={r.id}
            className={`fpm-history-item ${selectedId === r.id ? 'fpm-history-item-active' : ''}`}
            onClick={() => handleSelect(r)}
          >
            <div className="fpm-history-item-name">
              {r.error ? '❌' : r.method === 'ai' ? '🤖' : '📐'} {r.name}
            </div>
            <div className="fpm-history-item-meta">
              {r.modelLabel} · {r.prompt.slice(0, 40)}{r.prompt.length > 40 ? '...' : ''}
            </div>
            <div className="fpm-history-item-date">
              {new Date(r.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <div className="fpm-history-detail">
          <div className="fpm-history-detail-name">{detail.name}</div>
          <div className="fpm-badges" style={{ marginBottom: 8 }}>
            <span className={`fpm-badge fpm-badge-${detail.method}`}>
              {detail.method === 'ai' ? '🤖 AI' : '📐 Template'}
            </span>
            <span className="fpm-badge fpm-badge-model">{detail.modelLabel}</span>
          </div>
          <div className="fpm-history-field">
            <span className="fpm-history-field-label">Prompt:</span>
            <span>{detail.prompt}</span>
          </div>
          {detail.toolCalls.length > 0 && (
            <div className="fpm-history-field">
              <span className="fpm-history-field-label" style={{ color: '#eab308' }}>
                Tool Calls ({detail.toolCalls.length}):
              </span>
              {detail.toolCalls.map((tc, i) => (
                <div key={i} style={{ fontSize: 10, color: '#888' }}>🔧 {tc.name}</div>
              ))}
            </div>
          )}
          {detail.error && (
            <div style={{ color: '#ef4444', fontSize: 11 }}>❌ {detail.error}</div>
          )}
          {detail.parts.length > 0 && !detail.error && (
            <button className="fpm-load-btn" onClick={() => onLoadProp(detail)}>
              🔄 Load into Preview
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const fullscreenPropMakerStyles = `
.fpm-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(4px);
  animation: fpm-fadein 0.2s ease-out;
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--zen-fg, #e0e0e0);
}
@keyframes fpm-fadein { from { opacity: 0; } to { opacity: 1; } }

/* Top bar */
.fpm-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--zen-bg-panel, #1a1a2e);
  border-bottom: 1px solid var(--zen-border, #2a2a4a);
  flex-shrink: 0;
}
.fpm-topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}
.fpm-topbar-icon { font-size: 18px; }
.fpm-topbar-title { font-size: 14px; font-weight: 600; }
.fpm-topbar-status { font-size: 12px; }
.fpm-close {
  background: transparent;
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 4px;
  color: var(--zen-fg-dim, #888);
  width: 28px; height: 28px;
  font-size: 14px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.fpm-close:hover { color: var(--zen-fg, #e0e0e0); background: var(--zen-bg-hover, #2a2a4a); }

/* Split */
.fpm-split {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left side */
.fpm-left {
  width: 50%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--zen-border, #2a2a4a);
}
.fpm-controls {
  flex: 1;
  overflow: hidden;
  border-bottom: 1px solid var(--zen-border, #2a2a4a);
  background: var(--zen-bg-panel, #1a1a2e);
}
.fpm-controls-scroll {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
}
.fpm-controls-scroll::-webkit-scrollbar { width: 4px; }
.fpm-controls-scroll::-webkit-scrollbar-thumb { background: var(--zen-border, #2a2a4a); border-radius: 2px; }

/* Tabs */
.fpm-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}
.fpm-tab {
  background: transparent;
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px 8px 0 0;
  padding: 6px 14px;
  color: var(--zen-fg-dim, #888);
  font-size: 12px;
  cursor: pointer;
  font-weight: 400;
}
.fpm-tab-active {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.4);
  color: var(--zen-accent, #6366f1);
  font-weight: 700;
  border-bottom: 2px solid var(--zen-accent, #6366f1);
}

.fpm-description {
  font-size: 13px;
  color: var(--zen-fg-dim, #888);
  margin: 0 0 12px;
  line-height: 1.5;
}

/* Model row */
.fpm-model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.fpm-label { font-size: 12px; color: var(--zen-fg-dim, #888); white-space: nowrap; }
.fpm-select {
  flex: 1;
  background: var(--zen-bg, #0f0f23);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 6px;
  padding: 5px 8px;
  color: var(--zen-fg, #e0e0e0);
  font-size: 12px;
}

/* Examples */
.fpm-examples-section { margin-bottom: 10px; }
.fpm-examples-toggle {
  background: none; border: none;
  color: var(--zen-accent, #6366f1);
  font-size: 12px; cursor: pointer;
  text-decoration: underline; opacity: 0.8;
}
.fpm-examples-grid {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;
}
.fpm-example-btn {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.25);
  border-radius: 12px; padding: 4px 10px;
  color: var(--zen-fg-dim, #888); font-size: 11px; cursor: pointer;
}
.fpm-example-btn:hover { background: rgba(99, 102, 241, 0.2); }

/* Textarea + Create */
.fpm-textarea {
  width: 100%;
  background: var(--zen-bg, #0f0f23);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--zen-fg, #e0e0e0);
  font-size: 13px;
  resize: vertical;
  font-family: system-ui, sans-serif;
  margin-bottom: 8px;
  box-sizing: border-box;
}
.fpm-textarea:disabled { opacity: 0.5; }
.fpm-create-btn {
  width: 100%;
  background: var(--zen-accent, #6366f1);
  border: none; border-radius: 8px;
  padding: 8px 14px;
  color: white; font-weight: 600;
  font-size: 13px; cursor: pointer;
}
.fpm-create-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Error */
.fpm-error {
  margin-top: 10px; font-size: 12px;
  color: var(--zen-error, #ef4444); text-align: center;
}
.fpm-retry-btn {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 6px; padding: 4px 12px;
  color: var(--zen-error, #ef4444);
  font-size: 11px; cursor: pointer;
  margin-top: 6px;
}

/* Badges */
.fpm-badges {
  display: flex; gap: 6px; margin-top: 10px; justify-content: center; flex-wrap: wrap;
}
.fpm-badge {
  border-radius: 12px; padding: 2px 10px; font-size: 11px;
}
.fpm-badge-ai {
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.3);
  color: var(--zen-accent, #6366f1);
}
.fpm-badge-template {
  background: rgba(234, 179, 8, 0.15);
  border: 1px solid rgba(234, 179, 8, 0.3);
  color: #eab308;
}
.fpm-badge-model {
  background: var(--zen-bg, #0f0f23);
  border: 1px solid var(--zen-border, #2a2a4a);
  color: var(--zen-fg-dim, #888);
}

/* Action row */
.fpm-action-row {
  display: flex; gap: 10px; margin-top: 12px; justify-content: center;
}
.fpm-approve-btn {
  padding: 8px 20px; border-radius: 8px; border: none;
  background: var(--zen-accent, #6366f1);
  color: white; font-weight: 600; font-size: 13px; cursor: pointer;
}
.fpm-approve-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fpm-regen-btn {
  padding: 8px 20px; border-radius: 8px;
  border: 1px solid var(--zen-border, #2a2a4a);
  background: transparent;
  color: var(--zen-accent, #6366f1);
  font-weight: 600; font-size: 13px; cursor: pointer;
}

/* Thinking panel (bottom left) */
.fpm-thinking {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--zen-bg, #0f0f23);
  overflow: hidden;
  min-height: 0;
}
.fpm-thinking-header {
  padding: 10px 16px;
  font-size: 13px; font-weight: 700;
  color: var(--zen-accent, #6366f1);
  border-bottom: 1px solid var(--zen-border, #2a2a4a);
  flex-shrink: 0;
}
.fpm-live-badge {
  font-size: 10px; opacity: 0.6; margin-left: 8px;
}
.fpm-thinking-toggles {
  padding: 6px 16px 0;
  display: flex; gap: 6px; flex-wrap: wrap;
  flex-shrink: 0;
}
.fpm-expand-btn {
  background: transparent;
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 6px; padding: 2px 8px;
  font-size: 10px;
  color: var(--zen-accent, #6366f1);
  cursor: pointer;
}
.fpm-expand-content {
  background: var(--zen-bg-panel, #1a1a2e);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 6px; padding: 8px; margin: 6px 16px;
  font-size: 10px; line-height: 1.5;
  max-height: 120px; overflow-y: auto;
  white-space: pre-wrap; word-break: break-word;
  color: var(--zen-fg-dim, #888);
}
.fpm-thinking-log {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
  font-family: monospace;
  font-size: 11px;
  line-height: 1.8;
}
.fpm-thinking-log::-webkit-scrollbar { width: 4px; }
.fpm-thinking-log::-webkit-scrollbar-thumb { background: var(--zen-border, #2a2a4a); border-radius: 2px; }
.fpm-thinking-empty {
  color: var(--zen-fg-muted, #555);
  font-size: 12px;
  text-align: center;
  padding: 20px;
  font-family: system-ui, sans-serif;
}
.fpm-thinking-line { }
.fpm-thinking-indent {
  padding-left: 8px;
  border-left: 2px solid rgba(99, 102, 241, 0.3);
}
.fpm-cursor {
  color: var(--zen-accent, #6366f1);
  opacity: 0.5;
  animation: fpm-pulse 1s ease-in-out infinite;
}
@keyframes fpm-pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }

/* Right side: 3D Preview */
.fpm-right {
  width: 50%;
  position: relative;
  background: var(--zen-bg, #0f0f23);
}
.fpm-right canvas { width: 100% !important; height: 100% !important; }
.fpm-preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--zen-fg-dim, #888);
  font-size: 14px;
  gap: 8px;
}
.fpm-preview-spinner {
  font-size: 32px;
  animation: fpm-spin 2s linear infinite;
}
@keyframes fpm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.fpm-preview-sublabel {
  font-size: 11px;
  color: var(--zen-fg-muted, #555);
}
.fpm-preview-error {
  font-size: 11px;
  color: var(--zen-error, #ef4444);
  max-width: 300px;
  text-align: center;
  font-family: monospace;
  margin-top: 4px;
}
.fpm-preview-name {
  position: absolute;
  top: 12px; left: 12px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--zen-accent, #6366f1);
}

/* History */
.fpm-history {
  display: flex;
  gap: 12px;
  max-height: 100%;
}
.fpm-history-empty {
  color: var(--zen-fg-dim, #888);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}
.fpm-history-list {
  width: 50%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fpm-history-item {
  padding: 8px 10px;
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
}
.fpm-history-item:hover { background: rgba(99, 102, 241, 0.05); }
.fpm-history-item-active {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}
.fpm-history-item-name {
  font-weight: 600; margin-bottom: 2px;
}
.fpm-history-item-meta {
  color: var(--zen-fg-dim, #888); font-size: 10px;
}
.fpm-history-item-date {
  color: var(--zen-fg-muted, #555); font-size: 9px; margin-top: 2px;
}
.fpm-history-detail {
  flex: 1;
  overflow-y: auto;
  font-size: 11px;
}
.fpm-history-detail-name {
  font-weight: 700; font-size: 14px;
  color: var(--zen-accent, #6366f1);
  margin-bottom: 8px;
}
.fpm-history-field { margin-bottom: 6px; }
.fpm-history-field-label {
  font-size: 10px; font-weight: 600;
  color: var(--zen-fg-dim, #888);
  display: block; margin-bottom: 2px;
}
.fpm-load-btn {
  background: var(--zen-accent, #6366f1);
  border: none; border-radius: 8px;
  padding: 8px 14px;
  color: white; font-weight: 600;
  font-size: 12px; cursor: pointer;
  margin-top: 8px;
}
`

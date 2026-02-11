/**
 * Fullscreen Prop Maker View
 * Split-pane overlay: Left 50% (controls + think process), Right 50% (3D preview)
 */

import { useState, useRef, useCallback, useEffect, useMemo, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { DynamicProp, type PropPart } from './DynamicProp'
import { PropRefiner, type RefineChanges } from './PropRefiner'
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

type TabId = 'generate' | 'history' | 'advanced'

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
  const isDemoMode = window.location.hostname.includes('demo.')
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
  const [refinementOptions, setRefinementOptions] = useState<any>(null)
  const [isRefining, setIsRefining] = useState(false)
  const [generationId, setGenerationId] = useState<string>('')

  // AI thinking
  const [thinkingLines, setThinkingLines] = useState<ThinkingLine[]>([])
  const [fullPrompt, setFullPrompt] = useState<string | null>(null)
  const [toolCalls, setToolCalls] = useState<{ name: string; input: string }[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const thinkingScrollRef = useRef<HTMLDivElement>(null)

  // Phase 3: Quality & Iteration
  const [qualityScore, setQualityScore] = useState<any>(null)
  const [iterationFeedback, setIterationFeedback] = useState('')
  const [isIterating, setIsIterating] = useState(false)
  const [iterationHistory, setIterationHistory] = useState<{ version: number; feedback: string; score: number; code: string }[]>([])
  const [generationMode, setGenerationMode] = useState<'standard' | 'hybrid'>('standard')
  const [templateBase, setTemplateBase] = useState<string>('')
  const [availableStyles, setAvailableStyles] = useState<{ id: string; name: string; palette: string[] }[]>([])
  const [availableTemplates, setAvailableTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedStyle, setSelectedStyle] = useState('')
  const [isApplyingStyle, setIsApplyingStyle] = useState(false)

  const examplePrompts = [
    'A glowing mushroom lamp',
    'A steampunk gear clock',
    'A floating crystal orb',
    'A retro arcade cabinet',
    'A neon "OPEN" sign',
    'A tiny robot figurine',
  ]

  // Load models + Phase 3 data
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
    // Load styles and templates
    fetch('/api/creator/props/styles').then(r => r.json()).then(d => setAvailableStyles(d.styles || [])).catch(() => {})
    fetch('/api/creator/props/templates').then(r => r.json()).then(d => setAvailableTemplates(d.templates || [])).catch(() => {})
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
        setRefinementOptions(data.refinementOptions || null)
        setGenerationId(data.generationId || '')
        setIsGenerating(false)
        setHistoryRefreshKey(k => k + 1)
        setIterationHistory([])
        if (data.code) scoreQuality(data.code)
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

  // Phase 3: Score quality when code changes
  const scoreQuality = useCallback(async (code: string) => {
    try {
      const res = await fetch('/api/creator/props/quality-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        const score = await res.json()
        setQualityScore(score)
      }
    } catch { /* ignore */ }
  }, [])

  // Phase 3: Iterate on prop
  const handleIterate = useCallback(async () => {
    if (!iterationFeedback.trim() || !previewCode || isIterating) return
    setIsIterating(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/props/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: previewCode,
          feedback: iterationFeedback.trim(),
          componentName: previewName,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Iteration failed')
      const data = await res.json()
      
      // Save to iteration history
      setIterationHistory(prev => [...prev, {
        version: prev.length + 1,
        feedback: iterationFeedback.trim(),
        score: data.qualityScore?.overall || 0,
        code: previewCode,
      }])
      
      setPreviewCode(data.code)
      setQualityScore(data.qualityScore)
      setIterationFeedback('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Iteration failed')
    } finally {
      setIsIterating(false)
    }
  }, [iterationFeedback, previewCode, previewName, isIterating])

  // Phase 3: Apply style transfer
  const handleApplyStyle = useCallback(async () => {
    if (!selectedStyle || !previewCode || isApplyingStyle) return
    setIsApplyingStyle(true)
    setError(null)
    try {
      const res = await fetch('/api/creator/props/style-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: previewCode,
          styleSource: selectedStyle,
          componentName: previewName,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).detail || 'Style transfer failed')
      const data = await res.json()
      setPreviewCode(data.code)
      setQualityScore(data.qualityScore)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Style transfer failed')
    } finally {
      setIsApplyingStyle(false)
    }
  }, [selectedStyle, previewCode, previewName, isApplyingStyle])

  // Phase 3: Rollback to previous iteration
  const handleRollback = useCallback((version: number) => {
    const entry = iterationHistory.find(h => h.version === version)
    if (entry) {
      setPreviewCode(entry.code)
      scoreQuality(entry.code)
    }
  }, [iterationHistory, scoreQuality])

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

  const handleRefine = useCallback(async (changes: RefineChanges) => {
    if (!generationId || isRefining) return
    setIsRefining(true)
    try {
      const res = await fetch('/api/creator/props/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propId: generationId, changes }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.code) {
          setPreviewCode(data.code)
          if (data.refinementOptions) setRefinementOptions(data.refinementOptions)
          setThinkingLines(prev => [
            ...prev,
            { text: '🎨 Refinements applied:', type: 'correction' as const },
            ...data.diagnostics.map((d: string) => ({ text: `  ${d}`, type: 'correction' as const })),
          ])
        }
      }
    } catch (err) {
      console.error('Refine error:', err)
    } finally {
      setIsRefining(false)
    }
  }, [generationId, isRefining])

  const handleRefineReset = useCallback(() => {
    // Reload from history to get original code
    if (generationId) {
      fetch(`/api/creator/generation-history/${generationId}`)
        .then(r => r.json())
        .then(data => {
          if (data.code) setPreviewCode(data.code)
        })
        .catch(() => {})
    }
  }, [generationId])

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
                <button
                  className={`fpm-tab ${activeTab === 'advanced' ? 'fpm-tab-active' : ''}`}
                  onClick={() => setActiveTab('advanced')}
                >
                  🧬 Advanced
                </button>
              </div>

              {activeTab === 'generate' && (
                <>
                  {isDemoMode && (
                    <div className="fpm-demo-banner">
                      ⚠️ Demo Mode — Prop generation is disabled. You can browse existing history.
                    </div>
                  )}
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

                  {/* Mode & Template */}
                  <div className="fpm-model-row">
                    <label className="fpm-label">Mode:</label>
                    <select
                      value={generationMode}
                      onChange={(e) => setGenerationMode(e.target.value as 'standard' | 'hybrid')}
                      disabled={isGenerating}
                      className="fpm-select"
                    >
                      <option value="standard">Standard AI</option>
                      <option value="hybrid">Hybrid (Template + AI)</option>
                    </select>
                  </div>
                  {generationMode === 'hybrid' && (
                    <div className="fpm-model-row">
                      <label className="fpm-label">Base:</label>
                      <select
                        value={templateBase}
                        onChange={(e) => setTemplateBase(e.target.value)}
                        disabled={isGenerating}
                        className="fpm-select"
                      >
                        <option value="">None (enhanced AI)</option>
                        {availableTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

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
                    disabled={isDemoMode || isGenerating || !inputText.trim()}
                    title={isDemoMode ? 'Not available in demo mode' : undefined}
                  >
                    {isDemoMode ? '⚠️ Generate (Demo)' : isGenerating ? '⏳ Generating...' : '⚡ Create'}
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

                  {/* Quality Score */}
                  {qualityScore && !isGenerating && (
                    <div className="fpm-quality-panel">
                      <div className="fpm-quality-header">
                        Quality: {qualityScore.overall}/100
                        {qualityScore.overall >= 85 ? ' 🌟' : qualityScore.overall >= 70 ? ' ✨' : ' 💫'}
                      </div>
                      <div className="fpm-quality-bars">
                        {[
                          { label: 'Composition', value: qualityScore.composition_score },
                          { label: 'Color', value: qualityScore.color_score },
                          { label: 'Animation', value: qualityScore.animation_score },
                          { label: 'Detail', value: qualityScore.detail_score },
                          { label: 'Style', value: qualityScore.style_consistency },
                        ].map(({ label, value }) => (
                          <div key={label} className="fpm-quality-bar-row">
                            <span className="fpm-quality-bar-label">{label}</span>
                            <div className="fpm-quality-bar-track">
                              <div
                                className="fpm-quality-bar-fill"
                                style={{
                                  width: `${value}%`,
                                  background: value >= 80 ? '#22c55e' : value >= 50 ? '#eab308' : '#ef4444',
                                }}
                              />
                            </div>
                            <span className="fpm-quality-bar-value">{value}</span>
                          </div>
                        ))}
                      </div>
                      {qualityScore.suggestions?.length > 0 && (
                        <div className="fpm-quality-suggestions">
                          {qualityScore.suggestions.map((s: string, i: number) => (
                            <div key={i} className="fpm-quality-suggestion">💡 {s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Phase 2: Visual Refinement Panel */}
                  {previewParts && previewCode && !isGenerating && (
                    <PropRefiner
                      propName={previewName}
                      propId={generationId}
                      currentCode={previewCode}
                      refinementOptions={refinementOptions}
                      onApplyChanges={handleRefine}
                      onReset={handleRefineReset}
                      disabled={isRefining}
                    />
                  )}

                  {/* Iteration Panel */}
                  {previewCode && !isGenerating && (
                    <div className="fpm-iteration-panel">
                      <div className="fpm-iteration-header">🔄 Refine with Feedback</div>
                      <div className="fpm-iteration-input-row">
                        <input
                          type="text"
                          className="fpm-iteration-input"
                          placeholder="e.g. Make it more colorful, add blinking lights..."
                          value={iterationFeedback}
                          onChange={(e) => setIterationFeedback(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleIterate() }}
                          disabled={isIterating}
                        />
                        <button
                          className="fpm-iteration-btn"
                          onClick={handleIterate}
                          disabled={isIterating || !iterationFeedback.trim()}
                        >
                          {isIterating ? '⏳' : '✨'}
                        </button>
                      </div>
                      {iterationHistory.length > 0 && (
                        <div className="fpm-iteration-history">
                          {iterationHistory.map((h) => (
                            <div key={h.version} className="fpm-iteration-entry">
                              <span>v{h.version}: "{h.feedback}" (Score: {h.score})</span>
                              <button
                                className="fpm-iteration-rollback"
                                onClick={() => handleRollback(h.version)}
                                title="Rollback to this version"
                              >
                                ↩️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <HistoryPanel onLoadProp={handleLoadFromHistory} refreshKey={historyRefreshKey} />
              )}

              {activeTab === 'advanced' && (
                <div className="fpm-advanced">
                  {/* Style Transfer */}
                  <div className="fpm-advanced-section">
                    <div className="fpm-advanced-title">🎨 Style Transfer</div>
                    <p className="fpm-description">Apply a showcase prop's visual style to your current prop.</p>
                    <div className="fpm-model-row">
                      <label className="fpm-label">Style:</label>
                      <select
                        value={selectedStyle}
                        onChange={(e) => setSelectedStyle(e.target.value)}
                        className="fpm-select"
                        disabled={isApplyingStyle || !previewCode}
                      >
                        <option value="">Select style...</option>
                        {availableStyles.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    {selectedStyle && (
                      <div className="fpm-style-palette">
                        {availableStyles.find(s => s.id === selectedStyle)?.palette.map((c, i) => (
                          <div key={i} className="fpm-style-swatch" style={{ background: c }} title={c} />
                        ))}
                      </div>
                    )}
                    <button
                      className="fpm-create-btn"
                      onClick={handleApplyStyle}
                      disabled={!selectedStyle || !previewCode || isApplyingStyle}
                      style={{ marginTop: 8 }}
                    >
                      {isApplyingStyle ? '⏳ Applying...' : '🎨 Apply Style'}
                    </button>
                  </div>

                  {/* Crossbreeding placeholder */}
                  <div className="fpm-advanced-section">
                    <div className="fpm-advanced-title">🧬 Prop Genetics</div>
                    <p className="fpm-description">
                      Combine traits from two props to create unique hybrids.
                      Use the API endpoint <code>/api/creator/props/crossbreed</code> for programmatic access.
                    </p>
                    <div className="fpm-advanced-hint">
                      💡 Coming soon to the UI — available now via API
                    </div>
                  </div>

                  {/* Quality Tips */}
                  <div className="fpm-advanced-section">
                    <div className="fpm-advanced-title">💡 Quality Tips</div>
                    <div className="fpm-quality-tips">
                      <div>• Use <strong>Hybrid mode</strong> with a template base for best results</div>
                      <div>• <strong>Iterate</strong> with feedback to improve score by 10-20 points</div>
                      <div>• Apply <strong>style transfer</strong> from a showcase prop for consistent quality</div>
                      <div>• Aim for <strong>85+</strong> quality score for showcase-grade props</div>
                      <div>• Try <strong>"add blinking lights"</strong> or <strong>"more colorful"</strong> as feedback</div>
                    </div>
                  </div>
                </div>
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

.fpm-demo-banner {
  background: rgba(255, 165, 0, 0.15);
  border: 1px solid rgba(255, 165, 0, 0.3);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #f59e0b;
  text-align: center;
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
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
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

/* Phase 3: Quality Score Panel */
.fpm-quality-panel {
  margin-top: 12px;
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px;
  padding: 10px;
  background: rgba(99, 102, 241, 0.05);
}
.fpm-quality-header {
  font-size: 14px; font-weight: 700;
  color: var(--zen-accent, #6366f1);
  margin-bottom: 8px; text-align: center;
}
.fpm-quality-bars { display: flex; flex-direction: column; gap: 4px; }
.fpm-quality-bar-row { display: flex; align-items: center; gap: 6px; }
.fpm-quality-bar-label { font-size: 10px; color: var(--zen-fg-dim, #888); width: 70px; text-align: right; }
.fpm-quality-bar-track {
  flex: 1; height: 6px; background: var(--zen-bg, #0f0f23);
  border-radius: 3px; overflow: hidden;
}
.fpm-quality-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s; }
.fpm-quality-bar-value { font-size: 10px; color: var(--zen-fg-dim, #888); width: 24px; }
.fpm-quality-suggestions { margin-top: 8px; }
.fpm-quality-suggestion { font-size: 10px; color: var(--zen-fg-dim, #888); padding: 2px 0; }

/* Phase 3: Iteration Panel */
.fpm-iteration-panel {
  margin-top: 12px;
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px;
  padding: 10px;
}
.fpm-iteration-header {
  font-size: 12px; font-weight: 700;
  color: var(--zen-accent, #6366f1);
  margin-bottom: 6px;
}
.fpm-iteration-input-row { display: flex; gap: 6px; }
.fpm-iteration-input {
  flex: 1;
  background: var(--zen-bg, #0f0f23);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 6px; padding: 6px 10px;
  color: var(--zen-fg, #e0e0e0); font-size: 12px;
}
.fpm-iteration-input:disabled { opacity: 0.5; }
.fpm-iteration-btn {
  background: var(--zen-accent, #6366f1);
  border: none; border-radius: 6px;
  width: 36px; color: white; cursor: pointer; font-size: 14px;
}
.fpm-iteration-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fpm-iteration-history { margin-top: 8px; max-height: 100px; overflow-y: auto; }
.fpm-iteration-entry {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10px; color: var(--zen-fg-dim, #888); padding: 3px 0;
  border-bottom: 1px solid var(--zen-border, #2a2a4a);
}
.fpm-iteration-rollback {
  background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px;
}

/* Phase 3: Advanced Tab */
.fpm-advanced { display: flex; flex-direction: column; gap: 16px; }
.fpm-advanced-section {
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px; padding: 12px;
}
.fpm-advanced-title {
  font-size: 13px; font-weight: 700;
  color: var(--zen-accent, #6366f1);
  margin-bottom: 6px;
}
.fpm-advanced-hint {
  font-size: 11px; color: var(--zen-fg-muted, #555);
  font-style: italic; margin-top: 6px;
}
.fpm-style-palette {
  display: flex; gap: 4px; margin: 6px 0;
}
.fpm-style-swatch {
  width: 24px; height: 24px; border-radius: 4px;
  border: 1px solid var(--zen-border, #2a2a4a);
}
.fpm-quality-tips { font-size: 11px; color: var(--zen-fg-dim, #888); line-height: 1.8; }
`

/**
 * Fullscreen Prop Maker View
 * Split-pane overlay: Left 50% (controls + think process), Right 50% (3D preview).
 *
 * This component is the orchestrator: it owns all state and event handlers,
 * and delegates rendering to focused sub-components.
 *
 * Sub-components:
 *   - PropMakerToolbar  — top bar (title, status, close)
 *   - PropControls      — left-side tab panel (generate, history, advanced)
 *   - ThinkingPanel     — bottom-left AI thinking log
 *   - PropPreview       — right-side 3D canvas
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { PropPart } from './DynamicProp'
import type { RefineChanges } from './PropRefiner'
import { PropMakerToolbar } from './PropMakerToolbar'
import { PropControls } from './PropControls'
import { ThinkingPanel } from './ThinkingPanel'
import { PropPreview } from './PropPreview'
import type {
  ModelOption,
  ThinkingLine,
  GenerationRecord,
  TabId,
  TransformMode,
  GenerationMode,
} from './propMakerTypes'

// ── Props ─────────────────────────────────────────────────────

export interface FullscreenPropMakerProps {
  onClose: () => void
  onPropGenerated?: (prop: { name: string; filename: string; parts: PropPart[]; timestamp: number }) => void
}

// ── Component ─────────────────────────────────────────────────

export function FullscreenPropMaker({ onClose, onPropGenerated }: FullscreenPropMakerProps) {
  const isDemoMode = window.location.hostname.includes('demo.')

  // Navigation
  const [activeTab, setActiveTab] = useState<TabId>('generate')

  // Input / UI state
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

  // AI thinking log
  const [thinkingLines, setThinkingLines] = useState<ThinkingLine[]>([])
  const [fullPrompt, setFullPrompt] = useState<string | null>(null)
  const [toolCalls, setToolCalls] = useState<{ name: string; input: string }[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  // Part editor
  const [editMode, setEditMode] = useState(false)
  const [selectedPartIndex, setSelectedPartIndex] = useState<number | null>(null)
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  const [isTransformDragging, setIsTransformDragging] = useState(false)

  // Phase 3: Quality & Iteration
  const [qualityScore, setQualityScore] = useState<any>(null)
  const [iterationFeedback, setIterationFeedback] = useState('')
  const [isIterating, setIsIterating] = useState(false)
  const [iterationHistory, setIterationHistory] = useState<
    { version: number; feedback: string; score: number; code: string }[]
  >([])
  const [generationMode, setGenerationMode] = useState<GenerationMode>('standard')
  const [templateBase, setTemplateBase] = useState<string>('')
  const [availableStyles, setAvailableStyles] = useState<{ id: string; name: string; palette: string[] }[]>([])
  const [availableTemplates, setAvailableTemplates] = useState<{ id: string; name: string }[]>([])
  const [selectedStyle, setSelectedStyle] = useState('')
  const [isApplyingStyle, setIsApplyingStyle] = useState(false)

  // ── Setup effects ───────────────────────────────────────────

  // Load models, styles, templates
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
    fetch('/api/creator/props/styles').then(r => r.json()).then(d => setAvailableStyles(d.styles || [])).catch(() => {})
    fetch('/api/creator/props/templates').then(r => r.json()).then(d => setAvailableTemplates(d.templates || [])).catch(() => {})
  }, [])

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll; disable background canvas pointer events
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

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => { eventSourceRef.current?.close() }
  }, [])

  // ── Handlers ────────────────────────────────────────────────

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

    const addLine = (line: ThinkingLine) => setThinkingLines(prev => [...prev, line])

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

  // Phase 3: quality scoring
  const scoreQuality = useCallback(async (code: string) => {
    try {
      const res = await fetch('/api/creator/props/quality-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) setQualityScore(await res.json())
    } catch { /* ignore */ }
  }, [])

  // Phase 3: iterate on prop
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

  // Phase 3: style transfer
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

  // Phase 3: rollback to earlier iteration
  const handleRollback = useCallback((version: number) => {
    const entry = iterationHistory.find(h => h.version === version)
    if (entry) {
      setPreviewCode(entry.code)
      scoreQuality(entry.code)
    }
  }, [iterationHistory, scoreQuality])

  // Load record from history into preview
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

  // Visual refinement (Phase 2)
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
          if (data.parts?.length) setPreviewParts(data.parts)
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
    if (generationId) {
      fetch(`/api/creator/generation-history/${generationId}`)
        .then(r => r.json())
        .then(data => { if (data.code) setPreviewCode(data.code) })
        .catch(() => {})
    }
  }, [generationId])

  // Part editor callbacks
  const handlePartSelect = useCallback((index: number | null) => {
    setSelectedPartIndex(index)
  }, [])

  const handlePartTransform = useCallback(
    (index: number, position: [number, number, number], rotation: [number, number, number]) => {
      setPreviewParts(prev => {
        if (!prev) return prev
        const updated = [...prev]
        updated[index] = { ...updated[index], position, rotation }
        return updated
      })
    },
    []
  )

  const handleApplyPartEdits = useCallback(() => {
    setEditMode(false)
    setSelectedPartIndex(null)
    setThinkingLines(prev => [...prev, { text: '✏️ Part transforms applied', type: 'correction' as const }])
  }, [])

  const handleToggleEditMode = useCallback(() => {
    setEditMode(prev => !prev)
    setSelectedPartIndex(null)
  }, [])

  const handleRenderError = useCallback((err: Error) => {
    setRenderError(err.message)
  }, [])

  // ── Render ───────────────────────────────────────────────────

  const overlay = (
    <div className="fpm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <PropMakerToolbar
        isGenerating={isGenerating}
        successMessage={successMessage}
        onClose={onClose}
      />

      <div className="fpm-split">
        {/* Left: Controls + Thinking */}
        <div className="fpm-left">
          <PropControls
            activeTab={activeTab}
            onTabChange={setActiveTab}
            isDemoMode={isDemoMode}
            inputText={inputText}
            onInputChange={setInputText}
            isGenerating={isGenerating}
            onGenerate={() => handleGenerate()}
            onRegenerate={handleRegenerate}
            onRetry={handleRetry}
            error={error}
            models={models}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            generationMode={generationMode}
            onGenerationModeChange={setGenerationMode}
            templateBase={templateBase}
            onTemplateBaseChange={setTemplateBase}
            availableTemplates={availableTemplates}
            showExamples={showExamples}
            onToggleExamples={() => setShowExamples(v => !v)}
            onSelectExample={(p) => { setInputText(p); setShowExamples(false) }}
            previewParts={previewParts}
            previewMethod={previewMethod}
            previewModelLabel={previewModelLabel}
            previewName={previewName}
            previewCode={previewCode}
            renderError={renderError}
            isSaving={isSaving}
            onApprove={handleApprove}
            editMode={editMode}
            onToggleEditMode={handleToggleEditMode}
            selectedPartIndex={selectedPartIndex}
            transformMode={transformMode}
            onTransformModeChange={setTransformMode}
            onApplyPartEdits={handleApplyPartEdits}
            qualityScore={qualityScore}
            iterationFeedback={iterationFeedback}
            onIterationFeedbackChange={setIterationFeedback}
            isIterating={isIterating}
            onIterate={handleIterate}
            iterationHistory={iterationHistory}
            onRollback={handleRollback}
            generationId={generationId}
            refinementOptions={refinementOptions}
            isRefining={isRefining}
            onRefine={handleRefine}
            onRefineReset={handleRefineReset}
            availableStyles={availableStyles}
            selectedStyle={selectedStyle}
            onStyleChange={setSelectedStyle}
            isApplyingStyle={isApplyingStyle}
            onApplyStyle={handleApplyStyle}
            historyRefreshKey={historyRefreshKey}
            onLoadFromHistory={handleLoadFromHistory}
          />

          <ThinkingPanel
            thinkingLines={thinkingLines}
            isGenerating={isGenerating}
            fullPrompt={fullPrompt}
            toolCalls={toolCalls}
          />
        </div>

        {/* Right: 3D Preview */}
        <PropPreview
          previewParts={previewParts}
          previewName={previewName}
          isGenerating={isGenerating}
          renderError={renderError}
          previewModelLabel={previewModelLabel}
          selectedModel={selectedModel}
          editMode={editMode}
          selectedPartIndex={selectedPartIndex}
          transformMode={transformMode}
          isTransformDragging={isTransformDragging}
          onRenderError={handleRenderError}
          onRetry={handleRetry}
          onPartSelect={handlePartSelect}
          onPartTransform={handlePartTransform}
          onDraggingChanged={setIsTransformDragging}
        />
      </div>

      <style>{fullscreenPropMakerStyles}</style>
    </div>
  )

  return createPortal(overlay, document.body)
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
  background: var(--zen-bg, #0f0f23);
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
.fpm-generating-hint {
  font-size: 12px;
  color: var(--zen-fg-muted, #555);
  font-style: italic;
  margin-top: 8px;
  animation: fpm-fadein 0.5s ease-out;
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

/* Delete button on history items */
.fpm-history-item { position: relative; }
.fpm-history-delete-btn {
  position: absolute; top: 6px; right: 6px;
  background: none; border: none; cursor: pointer;
  font-size: 14px; opacity: 0; transition: opacity 0.15s;
  padding: 2px 4px; border-radius: 4px;
}
.fpm-history-item:hover .fpm-history-delete-btn { opacity: 0.6; }
.fpm-history-delete-btn:hover { opacity: 1 !important; background: rgba(239, 68, 68, 0.15); }

/* Delete button in detail view */
.fpm-delete-btn {
  background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px; padding: 8px 14px;
  color: #ef4444; font-weight: 600; font-size: 12px; cursor: pointer;
}
.fpm-delete-btn:hover { background: rgba(239, 68, 68, 0.25); }

/* Delete confirmation dialog */
.fpm-delete-overlay {
  position: fixed; inset: 0; z-index: 20000;
  background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
}
.fpm-delete-dialog {
  background: var(--zen-bg-panel, #1a1a2e); border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 12px; padding: 20px; max-width: 420px; width: 90%;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
}
.fpm-delete-title { font-size: 16px; font-weight: 700; margin-bottom: 12px; }
.fpm-delete-body { font-size: 13px; line-height: 1.6; color: var(--zen-fg-dim, #ccc); }
.fpm-delete-body p { margin: 0 0 8px; }
.fpm-delete-warning { color: #eab308; font-weight: 600; margin: 8px 0 4px; }
.fpm-delete-room-list {
  margin: 4px 0 8px 16px; padding: 0; font-size: 12px;
  color: var(--zen-fg-dim, #aaa);
}
.fpm-delete-room-list li { margin-bottom: 2px; }
.fpm-delete-more { color: var(--zen-fg-muted, #666); font-style: italic; }
.fpm-delete-cascade-note { color: #ef4444; font-weight: 600; }
.fpm-delete-note { color: var(--zen-fg-muted, #888); font-style: italic; }
.fpm-delete-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.fpm-delete-cancel-btn {
  background: var(--zen-bg-input, #2a2a4a); border: 1px solid var(--zen-border, #3a3a5a);
  border-radius: 8px; padding: 8px 16px; color: var(--zen-fg, #e0e0e0);
  font-size: 12px; font-weight: 600; cursor: pointer;
}
.fpm-delete-cancel-btn:hover { background: var(--zen-border, #3a3a5a); }
.fpm-delete-confirm-btn {
  background: #ef4444; border: none; border-radius: 8px;
  padding: 8px 16px; color: white; font-size: 12px; font-weight: 600; cursor: pointer;
}
.fpm-delete-confirm-btn:hover { background: #dc2626; }
.fpm-delete-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* Toast */
.fpm-toast {
  position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
  z-index: 25000; padding: 8px 16px; border-radius: 8px;
  font-size: 12px; font-weight: 600; animation: fpm-fadein 0.2s ease-out;
}
.fpm-toast-success { background: rgba(34, 197, 94, 0.2); border: 1px solid rgba(34, 197, 94, 0.4); color: #22c55e; }
.fpm-toast-error { background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444; }

/* Part Editor */
.fpm-part-editor {
  margin-top: 12px;
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px;
  padding: 10px;
  background: rgba(99, 102, 241, 0.03);
}
.fpm-part-editor-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 700; color: var(--zen-accent, #6366f1);
}
.fpm-edit-toggle {
  background: var(--zen-bg, #0f0f23);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 6px; padding: 4px 10px;
  color: var(--zen-fg-dim, #888); font-size: 11px; cursor: pointer;
}
.fpm-edit-toggle-active {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--zen-accent, #6366f1);
  color: var(--zen-accent, #6366f1);
}
.fpm-part-editor-controls { margin-top: 8px; }
.fpm-transform-modes { display: flex; gap: 6px; margin-bottom: 8px; }
.fpm-transform-btn {
  background: var(--zen-bg, #0f0f23);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 6px; padding: 4px 10px;
  color: var(--zen-fg-dim, #888); font-size: 11px; cursor: pointer;
  flex: 1;
}
.fpm-transform-btn-active {
  background: rgba(99, 102, 241, 0.15);
  border-color: var(--zen-accent, #6366f1);
  color: var(--zen-accent, #6366f1);
}
.fpm-selected-part-info {
  font-size: 11px; color: var(--zen-fg-dim, #888);
  padding: 4px 0; margin-bottom: 8px;
}
.fpm-apply-edits-btn {
  width: 100%;
  background: #22c55e; border: none; border-radius: 6px;
  padding: 6px 12px; color: white; font-weight: 600;
  font-size: 12px; cursor: pointer;
}
.fpm-apply-edits-btn:hover { background: #16a34a; }
`

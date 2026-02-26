/**
 * MobileCreatorView - Mobile-friendly Creator / Prop Maker view
 *
 * Provides a full-screen mobile UI for generating props:
 * - Text prompt → AI-generated 3D prop
 * - Inline 3D preview (WebGL/R3F) after successful generation
 * - Generation history
 */

import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react'
import { ArrowLeft, Wand2, Clock, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stage } from '@react-three/drei'
import { DynamicProp, type PropPart } from '../world3d/zones/creator/DynamicProp'

const BORDER_1PX_SOLID_VAR_MOBILE_BORDER_RG =
  '1px solid var(--mobile-border, rgba(255,255,255,0.08))'
const CORRECTION = 'correction'
const TOOL_RESULT = 'tool_result'
const TRANSPARENT = 'transparent'
const VAR_MOBILE_SURFACE = 'var(--mobile-surface, #1e293b)'
const VAR_MOBILE_TEXT_MUTED = 'var(--mobile-text-muted, #94a3b8)'

// ── Types ─────────────────────────────────────────────────────────

interface GenerationRecord {
  id: string
  prompt: string
  name: string
  model: string
  modelLabel: string
  method: string
  parts: PropPart[]
  code: string
  createdAt: string
  error: string | null
}

interface ThinkingLine {
  text: string
  type:
    | 'status'
    | 'thinking'
    | 'text'
    | 'tool'
    | typeof TOOL_RESULT
    | typeof CORRECTION
    | 'complete'
    | 'error'
    | 'model'
    | 'prompt'
}

// ── Error Boundary ─────────────────────────────────────────────────

interface PropErrorBoundaryState {
  hasError: boolean
}

class PropErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; resetKey?: string },
  PropErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode; resetKey?: string }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): PropErrorBoundaryState {
    return { hasError: true }
  }
  componentDidUpdate(prevProps: { resetKey?: string }) {
    // Reset error state when new parts are provided (resetKey changes)
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              fontSize: 13,
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 28 }}>⚠️</span>
            <span>3D preview unavailable</span>
          </div>
        )
      )
    }
    return this.props.children
  }
}

// ── 3D Preview Component ────────────────────────────────────────────

interface PropPreview3DProps {
  readonly parts: PropPart[]
  readonly name: string
}

function PropPreview3D({ parts, name }: PropPreview3DProps) {
  return (
    <div
      style={{
        width: '100%',
        height: 250,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--mobile-surface, #0f1e35)',
        border: '1px solid var(--mobile-border, rgba(99,102,241,0.25))',
        position: 'relative',
      }}
    >
      <PropErrorBoundary resetKey={`${name}-${parts.length}`}>
        <Canvas camera={{ position: [3, 2, 3], fov: 45 }} style={{ width: '100%', height: '100%' }}>
          <Suspense fallback={null}>
            <Stage adjustCamera={false} environment="city" intensity={0.5}>
              <DynamicProp parts={parts} position={[0, 0, 0]} scale={3} />
            </Stage>
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan={false}
            enableZoom
            minDistance={1}
            maxDistance={15}
          />
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
        </Canvas>
      </PropErrorBoundary>

      {/* Label overlay */}
      {name && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
            borderRadius: 20,
            padding: '3px 10px',
            fontSize: 11,
            color: '#e2e8f0',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          🔍 {name}
        </div>
      )}

      {/* Drag hint */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 10,
          fontSize: 10,
          color: 'rgba(148,163,184,0.6)',
          pointerEvents: 'none',
        }}
      >
        drag to rotate
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────

interface MobileCreatorViewProps {
  readonly onBack: () => void
}

export function MobileCreatorView({ onBack }: MobileCreatorViewProps) {
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')

  return (
    <div
      style={{
        height: '100dvh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mobile-bg, #0f172a)',
        color: 'var(--mobile-text, #e2e8f0)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
          background: VAR_MOBILE_SURFACE,
          borderBottom: BORDER_1PX_SOLID_VAR_MOBILE_BORDER_RG,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            border: 'none',
            background: 'var(--mobile-surface2, rgba(255,255,255,0.06))',
            color: VAR_MOBILE_TEXT_MUTED,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🎨</span>
          <h1
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--mobile-text, #f1f5f9)',
            }}
          >
            Creator
          </h1>
        </div>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          borderBottom: BORDER_1PX_SOLID_VAR_MOBILE_BORDER_RG,
          background: VAR_MOBILE_SURFACE,
          flexShrink: 0,
        }}
      >
        {(
          [
            { id: 'generate' as const, label: '⚡ Prop Maker' },
            { id: 'history' as const, label: '📋 History' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '11px 8px',
              border: 'none',
              background: TRANSPARENT,
              color: activeTab === tab.id ? '#818cf8' : VAR_MOBILE_TEXT_MUTED,
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
        {activeTab === 'generate' ? <PropGeneratorTab /> : <PropHistoryTab />}
      </div>
    </div>
  )
}

// ── Generator Tab ─────────────────────────────────────────────────

function PropGeneratorTab() {
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [thinkingLines, setThinkingLines] = useState<ThinkingLine[]>([])
  const [result, setResult] = useState<{ name: string; parts: PropPart[]; code: string } | null>(
    null
  )
  const [error, setError] = useState<string | null>(null)
  const [showExamples, setShowExamples] = useState(false)
  const [showThinking, setShowThinking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
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
    return () => {
      eventSourceRef.current?.close()
    }
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
    setIsSaved(false)
    setThinkingLines([])
    setShowThinking(true)

    const addLine = (line: ThinkingLine) => setThinkingLines((prev) => [...prev, line])

    try {
      const url = `/api/creator/generate-prop-stream?prompt=${encodeURIComponent(text)}&model=sonnet-4-5`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.addEventListener('status', (e) =>
        addLine({ text: JSON.parse(e.data).message, type: 'status' })
      )
      es.addEventListener('model', (e) => {
        const d = JSON.parse(e.data)
        addLine({ text: `🎯 Model: ${d.modelLabel}`, type: 'model' })
      })
      es.addEventListener('thinking', (e) =>
        addLine({ text: `💭 ${JSON.parse(e.data).text}`, type: 'thinking' })
      )
      es.addEventListener('text', (e) =>
        addLine({ text: `📝 ${JSON.parse(e.data).text}`, type: 'text' })
      )
      es.addEventListener('tool', (e) =>
        addLine({ text: JSON.parse(e.data).message, type: 'tool' })
      )
      es.addEventListener(TOOL_RESULT, (e) =>
        addLine({ text: JSON.parse(e.data).message, type: TOOL_RESULT })
      )
      es.addEventListener(CORRECTION, (e) =>
        addLine({ text: JSON.parse(e.data).message, type: CORRECTION })
      )

      es.addEventListener('complete', (e) => {
        const data = JSON.parse(e.data)
        es.close()
        eventSourceRef.current = null
        addLine({ text: '✅ Prop generated successfully!', type: 'complete' })
        if (data.parts?.length) {
          setResult({ name: data.name, parts: data.parts as PropPart[], code: data.code || '' })
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

  const handleSave = useCallback(async () => {
    if (!result || isSaving || isSaved) return
    setIsSaving(true)
    setError(null)
    const kebabName = result.name.replaceAll(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
    try {
      const res = await fetch('/api/creator/save-prop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: result.name,
          propId: kebabName,
          code: result.code,
          parts: result.parts,
          mountType: 'floor',
          yOffset: 0.16,
        }),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData?.detail || 'Save failed')
      }
      setIsSaved(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [result, isSaving, isSaved])

  const getLineColor = (line: ThinkingLine, isLast: boolean) => {
    if (line.type === 'error') return '#ef4444'
    if (line.type === 'complete') return '#22c55e'
    if (line.type === CORRECTION) return '#f59e0b'
    if (line.type === 'tool' || line.type === TOOL_RESULT) return '#eab308'
    if (line.type === 'thinking') return isLast ? '#818cf8' : '#64748b'
    if (isLast) return '#818cf8'
    return '#64748b'
  }

  let saveBtnLabel: string
  if (isSaved) {
    saveBtnLabel = '✅ Saved!'
  } else if (isSaving) {
    saveBtnLabel = '💾 Saving…'
  } else {
    saveBtnLabel = '💾 Save to Library'
  }

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Examples toggle */}
      <div>
        <button
          onClick={() => setShowExamples(!showExamples)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: TRANSPARENT,
            border: 'none',
            color: VAR_MOBILE_TEXT_MUTED,
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {showExamples ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Example prompts
        </button>
        {showExamples && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 10,
            }}
          >
            {examplePrompts.map((p) => (
              <button
                key={p}
                onClick={() => {
                  setInputText(p)
                  setShowExamples(false)
                }}
                style={{
                  padding: '6px 12px',
                  background: 'var(--mobile-surface2, rgba(255,255,255,0.05))',
                  border: '1px solid var(--mobile-border, rgba(255,255,255,0.1))',
                  borderRadius: 20,
                  color: 'var(--mobile-text-secondary, #cbd5e1)',
                  fontSize: 12,
                  cursor: 'pointer',
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
          onChange={(e) => setInputText(e.target.value)}
          disabled={isGenerating}
          rows={3}
          style={{
            width: '100%',
            padding: '12px 14px',
            background: VAR_MOBILE_SURFACE,
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
            background:
              isGenerating || !inputText.trim()
                ? 'rgba(99,102,241,0.3)'
                : 'linear-gradient(135deg, #6366f1, #818cf8)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: 15,
            fontWeight: 600,
            cursor: isGenerating || !inputText.trim() ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.15s',
          }}
        >
          <Wand2 size={18} />
          {isGenerating ? 'Generating...' : '⚡ Create Prop'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 14px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            color: '#fca5a5',
            fontSize: 13,
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* 3D Preview — shown after successful generation */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Success banner */}
          <div
            style={{
              padding: '12px 14px',
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 20 }}>🎉</span>
            <div>
              <div style={{ fontWeight: 600, color: '#86efac', fontSize: 15 }}>{result.name}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                {result.parts.length} part{result.parts.length === 1 ? '' : 's'} generated
              </div>
            </div>
          </div>

          {/* 3D Canvas */}
          <PropPreview3D parts={result.parts} name={result.name} />

          {/* Save to Library button */}
          <button
            onClick={handleSave}
            disabled={isSaved || isSaving}
            style={{
              padding: '13px 20px',
              background: (() => {
                if (isSaved) return 'rgba(34,197,94,0.15)'
                if (isSaving) return 'rgba(99,102,241,0.2)'
                return 'linear-gradient(135deg, #059669, #10b981)'
              })(),
              border: isSaved ? '1px solid rgba(34,197,94,0.35)' : '1px solid transparent',
              borderRadius: 12,
              color: isSaved ? '#86efac' : '#fff',
              fontSize: 15,
              fontWeight: 600,
              cursor: isSaved || isSaving ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.15s',
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {saveBtnLabel}
          </button>
        </div>
      )}

      {/* Generating placeholder (while generating, after a previous result was cleared) */}
      {isGenerating && (
        <div
          style={{
            width: '100%',
            height: 250,
            borderRadius: 12,
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: '#818cf8',
            fontSize: 14,
          }}
        >
          <span style={{ fontSize: 36 }}>⚙️</span>
          <span>Generating prop…</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>This may take a minute</span>
        </div>
      )}

      {/* AI Thinking panel */}
      {thinkingLines.length > 0 && (
        <div
          style={{
            background: VAR_MOBILE_SURFACE,
            border: BORDER_1PX_SOLID_VAR_MOBILE_BORDER_RG,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <button
            onClick={() => setShowThinking(!showThinking)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: TRANSPARENT,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: VAR_MOBILE_TEXT_MUTED,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <span>🧠 AI Thinking Process {isGenerating ? '⏳' : ''}</span>
            {showThinking ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showThinking && (
            <div
              ref={thinkingScrollRef}
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                padding: '0 14px 12px',
                fontSize: 11,
                lineHeight: 1.6,
              }}
            >
              {thinkingLines.map((line, i) => (
                <div
                  key={`line-${line.type}-${line.text}`}
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

/** Convert CamelCase or PascalCase prop names to readable display names.
 *  "GamingLaptopWithRgb" → "Gaming Laptop With Rgb"
 */
function formatPropName(name: string): string {
  if (!name) return ''
  return name
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim()
}

function PropHistoryTab() {
  const [records, setRecords] = useState<GenerationRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRecord, setSelectedRecord] = useState<GenerationRecord | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch('/api/creator/generation-history?limit=50')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        setRecords(Array.isArray(data.records) ? data.records : [])
        setLoading(false)
      })
      .catch(() => {
        // Silently handle — error state is shown in UI
        setError('Could not load history')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: '#94a3b8',
          fontSize: 14,
        }}
      >
        <Clock size={16} style={{ opacity: 0.5 }} />
        Loading history…
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 32,
        }}
      >
        <span style={{ fontSize: 32 }}>⚠️</span>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>
            Load failed
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>{error}</div>
        </div>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: '#64748b',
          padding: 32,
        }}
      >
        <Clock size={36} style={{ opacity: 0.3 }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
            No props yet
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Generate your first prop to see it here
          </div>
        </div>
      </div>
    )
  }

  return (
    // position: relative so the detail overlay (position: absolute) sits inside this container
    <div
      style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* ── Scrollable list ── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Count */}
        <div style={{ fontSize: 11, color: '#64748b', paddingLeft: 2, paddingBottom: 2 }}>
          {records.length} generation{records.length === 1 ? '' : 's'}
        </div>

        {records.map((record) => {
          const hasError = !!record.error
          const hasParts = !hasError && Array.isArray(record.parts) && record.parts.length > 0
          let methodIcon: string
          if (hasError) {
            methodIcon = '❌'
          } else if (record.method === 'ai') {
            methodIcon = '🤖'
          } else {
            methodIcon = '📐'
          }
          const displayName = formatPropName(record.name) || record.prompt || 'Untitled prop'
          let promptPreview = ''
          if (record.prompt) {
            promptPreview =
              record.prompt.length > 72 ? record.prompt.slice(0, 69) + '…' : record.prompt
          }

          // Date formatting
          let dateStr = record.createdAt?.slice(0, 10) ?? ''
          let timeStr = ''
          try {
            const date = new Date(record.createdAt)
            dateStr = date.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short' })
            timeStr = date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
          } catch {
            /* intentionally empty */
          }

          return (
            <button
              key={record.id}
              onClick={() => setSelectedRecord(record)}
              style={{
                width: '100%',
                background: VAR_MOBILE_SURFACE,
                border: '1px solid var(--mobile-border, rgba(255,255,255,0.07))',
                borderRadius: 12,
                padding: '12px 14px',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#e2e8f0',
                // No expand logic — just a tap target
              }}
            >
              {/* iOS Safari: flex on inner div, not on button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  pointerEvents: 'none',
                }}
              >
                {/* Method icon */}
                <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.2, marginTop: 1 }}>
                  {methodIcon}
                </span>

                {/* Text block */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Prop name */}
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: hasError ? '#fca5a5' : '#f1f5f9',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginBottom: 3,
                    }}
                  >
                    {displayName}
                  </div>

                  {/* Prompt preview */}
                  {promptPreview && (
                    <div
                      style={{
                        fontSize: 12,
                        color: '#94a3b8',
                        marginBottom: 5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {promptPreview}
                    </div>
                  )}

                  {/* Meta row: date + badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {dateStr && (
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {dateStr} {timeStr}
                      </span>
                    )}
                    {hasParts && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#818cf8',
                          background: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(99,102,241,0.2)',
                          borderRadius: 10,
                          padding: '1px 7px',
                          fontWeight: 600,
                        }}
                      >
                        {record.parts.length} part{record.parts.length === 1 ? '' : 's'}
                      </span>
                    )}
                    {hasError && (
                      <span
                        style={{
                          fontSize: 10,
                          color: '#fca5a5',
                          background: 'rgba(239,68,68,0.1)',
                          borderRadius: 10,
                          padding: '1px 7px',
                        }}
                      >
                        failed
                      </span>
                    )}
                  </div>
                </div>

                {/* Chevron right — indicates tap to open */}
                <div style={{ flexShrink: 0, color: '#475569', marginTop: 3 }}>
                  <ChevronRight size={16} />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Full-screen detail overlay — position:absolute bypasses iOS scroll container ── */}
      {selectedRecord && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'var(--mobile-bg, #0f172a)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <PropDetailView record={selectedRecord} onBack={() => setSelectedRecord(null)} />
        </div>
      )}
    </div>
  )
}

// ── Prop Detail View ──────────────────────────────────────────────

interface PropDetailViewProps {
  readonly record: GenerationRecord
  readonly onBack: () => void
}

function PropDetailView({ record, onBack }: PropDetailViewProps) {
  const [showing3D, setShowing3D] = useState(false)

  const hasError = !!record.error
  const hasParts = !hasError && Array.isArray(record.parts) && record.parts.length > 0
  let methodIcon: string
  if (hasError) {
    methodIcon = '❌'
  } else if (record.method === 'ai') {
    methodIcon = '🤖'
  } else {
    methodIcon = '📐'
  }
  const displayName = formatPropName(record.name) || record.prompt || 'Untitled prop'

  let dateStr = record.createdAt?.slice(0, 10) ?? ''
  let timeStr = ''
  try {
    const date = new Date(record.createdAt)
    dateStr = date.toLocaleDateString('nl-BE', { day: '2-digit', month: 'long', year: 'numeric' })
    timeStr = date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    /* intentionally empty */
  }

  return (
    <>
      {/* ── Detail header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          background: VAR_MOBILE_SURFACE,
          borderBottom: BORDER_1PX_SOLID_VAR_MOBILE_BORDER_RG,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: TRANSPARENT,
            border: 'none',
            color: '#818cf8',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 0',
          }}
        >
          <ArrowLeft size={16} />
          History
        </button>
      </div>

      {/* ── Scrollable detail content ── */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Prop name + icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32, flexShrink: 0 }}>{methodIcon}</span>
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: hasError ? '#fca5a5' : '#f1f5f9',
              lineHeight: 1.25,
            }}
          >
            {displayName}
          </h2>
        </div>

        {/* Date / time */}
        {dateStr && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: '#64748b',
              fontSize: 13,
            }}
          >
            <Clock size={13} />
            {dateStr}
            {timeStr ? ` · ${timeStr}` : ''}
          </div>
        )}

        {/* Meta chips: model + parts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {record.modelLabel && (
            <span
              style={{
                fontSize: 12,
                color: '#94a3b8',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: 8,
                padding: '4px 10px',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              🎯 {record.modelLabel}
            </span>
          )}
          {hasParts && (
            <span
              style={{
                fontSize: 12,
                color: '#818cf8',
                background: 'rgba(99,102,241,0.1)',
                borderRadius: 8,
                padding: '4px 10px',
                border: '1px solid rgba(99,102,241,0.2)',
                fontWeight: 600,
              }}
            >
              📦 {record.parts.length} part{record.parts.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Full prompt */}
        <div
          style={{
            background: VAR_MOBILE_SURFACE,
            border: BORDER_1PX_SOLID_VAR_MOBILE_BORDER_RG,
            borderRadius: 12,
            padding: '12px 14px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#64748b',
              fontWeight: 600,
              marginBottom: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Prompt
          </div>
          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6 }}>
            {record.prompt || '—'}
          </div>
        </div>

        {/* Error message */}
        {hasError && (
          <div
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 12,
              padding: '12px 14px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: '#f87171',
                fontWeight: 600,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Error
            </div>
            <div style={{ fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>{record.error}</div>
          </div>
        )}

        {/* View in 3D */}
        {hasParts && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              onClick={() => setShowing3D((v) => !v)}
              style={{
                padding: '12px 16px',
                background: showing3D ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)',
                border: '1px solid rgba(99,102,241,0.35)',
                borderRadius: 12,
                color: '#818cf8',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              {showing3D ? '🔼 Hide 3D Preview' : '🔽 View in 3D'}
            </button>
            {showing3D && <PropPreview3D parts={record.parts} name={record.name} />}
          </div>
        )}
      </div>
    </>
  )
}

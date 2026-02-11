import { useState, useRef, useCallback, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useToonMaterialProps } from '../../utils/toonMaterials'
import { PreviewPanel } from './PreviewPanel'
import { DynamicProp, type PropPart } from './DynamicProp'
import { FullscreenPropMaker } from './FullscreenPropMaker'
import * as THREE from 'three'

export interface GeneratedPropData {
  name: string
  filename: string
  parts: PropPart[]
  timestamp: number
}

interface PropMakerMachineProps {
  position?: [number, number, number]
  rotation?: number
  onPropGenerated?: (prop: GeneratedPropData) => void
}

interface GeneratedProp {
  name: string
  filename: string
  timestamp: number
}

// ─── Types ──────────────────────────────────────────────────────

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

// ─── Shared Styles ──────────────────────────────────────────────

const cardBg = 'hsl(var(--card))'
const border = 'hsl(var(--border))'
const primary = 'hsl(var(--primary))'
const muted = 'hsl(var(--muted-foreground))'
const fg = 'hsl(var(--foreground))'

// ─── Model Chooser ──────────────────────────────────────────────

function ModelChooser({
  models,
  selected,
  onChange,
  disabled,
}: {
  models: ModelOption[]
  selected: string
  onChange: (key: string) => void
  disabled: boolean
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
      <label style={{ fontSize: '12px', color: muted, whiteSpace: 'nowrap' }}>Model:</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          flex: 1,
          background: 'hsl(var(--secondary))',
          border: `1px solid ${border}`,
          borderRadius: '6px',
          padding: '5px 8px',
          color: fg,
          fontSize: '12px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {models.map((m) => (
          <option key={m.key} value={m.key}>
            {m.label} ({m.provider})
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── AI Thinking Panel ──────────────────────────────────────────

function ThinkingPanel({
  isGenerating,
  lines,
  fullPrompt,
  toolCalls,
}: {
  isGenerating: boolean
  lines: ThinkingLine[]
  fullPrompt: string | null
  toolCalls: { name: string; input: string }[]
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [showTools, setShowTools] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines])

  if (!isGenerating && lines.length === 0) return null

  const getLineColor = (line: ThinkingLine, isLast: boolean) => {
    if (line.type === 'error') return 'hsl(var(--destructive))'
    if (line.type === 'complete') return primary
    if (line.type === 'correction') return 'hsl(30 95% 60%)'
    if (line.type === 'tool' || line.type === 'tool_result') return 'hsl(45 93% 58%)'
    if (line.type === 'thinking') return isLast ? primary : muted
    if (isLast) return primary
    return muted
  }

  return (
    <div style={{
      width: '600px',
      background: cardBg,
      border: `1px solid ${border}`,
      borderRadius: '16px',
      padding: '16px',
      fontFamily: 'monospace',
      color: fg,
      boxShadow: `0 0 20px hsl(var(--primary) / 0.08)`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: primary, marginBottom: '8px', fontFamily: 'system-ui, sans-serif' }}>
        🧠 AI Thinking Process {lines.some(l => l.type === 'thinking') && <span style={{ fontSize: '10px', opacity: 0.6 }}>LIVE</span>}
      </div>

      {/* Expandable sections */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {fullPrompt && (
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            style={{
              background: showPrompt ? 'hsl(var(--primary) / 0.15)' : 'transparent',
              border: `1px solid hsl(var(--primary) / 0.3)`,
              borderRadius: '6px', padding: '2px 8px', fontSize: '10px',
              color: primary, cursor: 'pointer',
            }}
          >
            📜 Full Prompt {showPrompt ? '▴' : '▾'}
          </button>
        )}
        {toolCalls.length > 0 && (
          <button
            onClick={() => setShowTools(!showTools)}
            style={{
              background: showTools ? 'hsl(45 93% 58% / 0.15)' : 'transparent',
              border: '1px solid hsl(45 93% 58% / 0.3)',
              borderRadius: '6px', padding: '2px 8px', fontSize: '10px',
              color: 'hsl(45 93% 58%)', cursor: 'pointer',
            }}
          >
            🔧 Tool Calls ({toolCalls.length}) {showTools ? '▴' : '▾'}
          </button>
        )}
      </div>

      {/* Full prompt view */}
      {showPrompt && fullPrompt && (
        <div style={{
          background: 'hsl(var(--secondary))',
          border: `1px solid ${border}`,
          borderRadius: '6px',
          padding: '8px',
          fontSize: '10px',
          lineHeight: 1.5,
          maxHeight: '150px',
          overflowY: 'auto',
          marginBottom: '8px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: muted,
        }}>
          {fullPrompt}
        </div>
      )}

      {/* Tool calls view */}
      {showTools && toolCalls.length > 0 && (
        <div style={{
          background: 'hsl(var(--secondary))',
          border: `1px solid ${border}`,
          borderRadius: '6px',
          padding: '8px',
          fontSize: '10px',
          maxHeight: '120px',
          overflowY: 'auto',
          marginBottom: '8px',
        }}>
          {toolCalls.map((tc, i) => (
            <div key={i} style={{ marginBottom: '4px', color: 'hsl(45 93% 58%)' }}>
              <strong>{tc.name}</strong>
              <span style={{ color: muted, marginLeft: '6px' }}>{tc.input}</span>
            </div>
          ))}
        </div>
      )}

      {/* Thinking log */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          fontSize: '11px',
          lineHeight: 1.8,
          minHeight: '120px',
          maxHeight: '250px',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              color: getLineColor(line, i === lines.length - 1),
              paddingLeft: line.type === 'thinking' ? '8px' : '0',
              borderLeft: line.type === 'thinking' ? `2px solid hsl(var(--primary) / 0.3)` : 'none',
            }}
          >
            {line.text}
          </div>
        ))}
        {isGenerating && (
          <div style={{ color: primary, opacity: 0.5, animation: 'pulse 1s ease-in-out infinite' }}>▍</div>
        )}
      </div>
      <style>{`@keyframes thinkFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

// ─── Generation History Panel ───────────────────────────────────

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
      .then(data => {
        setRecords(data.records || [])
        setLoading(false)
      })
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

  if (loading) return <div style={{ color: muted, fontSize: '13px', textAlign: 'center', padding: '20px' }}>Loading history...</div>
  if (records.length === 0) return <div style={{ color: muted, fontSize: '13px', textAlign: 'center', padding: '20px' }}>No generations yet</div>

  return (
    <div style={{ display: 'flex', gap: '12px', maxHeight: '500px' }}>
      {/* List */}
      <div style={{ width: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {records.map((r) => (
          <div
            key={r.id}
            onClick={() => handleSelect(r)}
            style={{
              padding: '8px 10px',
              background: selectedId === r.id ? 'hsl(var(--primary) / 0.1)' : 'transparent',
              border: `1px solid ${selectedId === r.id ? 'hsl(var(--primary) / 0.3)' : border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            <div style={{ fontWeight: 600, color: fg, marginBottom: '2px' }}>
              {r.error ? '❌' : r.method === 'ai' ? '🤖' : '📐'} {r.name}
            </div>
            <div style={{ color: muted, fontSize: '10px' }}>
              {r.modelLabel} · {r.prompt.slice(0, 40)}{r.prompt.length > 40 ? '...' : ''}
            </div>
            <div style={{ color: muted, fontSize: '9px', marginTop: '2px' }}>
              {new Date(r.createdAt).toLocaleString()}
            </div>
          </div>
        ))}
      </div>

      {/* Detail */}
      {detail && (
        <div style={{ flex: 1, overflowY: 'auto', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: primary }}>{detail.name}</div>
          
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{
              background: detail.method === 'ai' ? 'hsl(var(--primary) / 0.15)' : 'hsl(45 93% 58% / 0.15)',
              border: `1px solid ${detail.method === 'ai' ? 'hsl(var(--primary) / 0.3)' : 'hsl(45 93% 58% / 0.3)'}`,
              borderRadius: '10px', padding: '2px 8px', fontSize: '10px',
              color: detail.method === 'ai' ? primary : 'hsl(45 93% 58%)',
            }}>
              {detail.method === 'ai' ? '🤖 AI' : '📐 Template'}
            </span>
            <span style={{
              background: 'hsl(var(--secondary))',
              borderRadius: '10px', padding: '2px 8px', fontSize: '10px', color: muted,
            }}>
              {detail.modelLabel}
            </span>
          </div>

          <div>
            <div style={{ color: muted, fontSize: '10px', fontWeight: 600, marginBottom: '2px' }}>Prompt:</div>
            <div style={{ color: fg }}>{detail.prompt}</div>
          </div>

          {detail.toolCalls.length > 0 && (
            <div>
              <div style={{ color: 'hsl(45 93% 58%)', fontSize: '10px', fontWeight: 600, marginBottom: '2px' }}>
                Tool Calls ({detail.toolCalls.length}):
              </div>
              {detail.toolCalls.map((tc, i) => (
                <div key={i} style={{ color: muted, fontSize: '10px' }}>🔧 {tc.name}</div>
              ))}
            </div>
          )}

          {detail.diagnostics.length > 0 && (
            <div>
              <div style={{ color: 'hsl(30 95% 60%)', fontSize: '10px', fontWeight: 600, marginBottom: '2px' }}>Diagnostics:</div>
              {detail.diagnostics.map((d, i) => (
                <div key={i} style={{ color: muted, fontSize: '10px' }}>{d}</div>
              ))}
            </div>
          )}

          {detail.error && (
            <div style={{ color: 'hsl(var(--destructive))', fontSize: '11px' }}>
              ❌ {detail.error}
            </div>
          )}

          {detail.parts.length > 0 && !detail.error && (
            <button
              onClick={() => onLoadProp(detail)}
              style={{
                background: primary,
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                color: 'hsl(var(--primary-foreground))',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              🔄 Load into Preview
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Preview Component Factory ──────────────────────────────────

function createPartsPreviewComponent(parts: PropPart[]): React.FC<any> {
  return function PartsPreview({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
    return <DynamicProp parts={parts} position={position} scale={3} />
  }
}

// ─── Main Component ─────────────────────────────────────────────

export function PropMakerMachine({ position = [0, 0, 0], rotation = 0, onPropGenerated }: PropMakerMachineProps) {
  const [hovered, setHovered] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('generate')
  const [inputText, setInputText] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [generatedProps, setGeneratedProps] = useState<GeneratedProp[]>([])
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

  const examplePrompts = [
    'A glowing mushroom lamp',
    'A steampunk gear clock',
    'A floating crystal orb',
    'A retro arcade cabinet',
    'A neon "OPEN" sign',
    'A tiny robot figurine',
  ]
  const coreRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)

  const baseToon = useToonMaterialProps('#1a1a2e')
  const panelToon = useToonMaterialProps('#16213e')
  const trimToon = useToonMaterialProps('#0f3460')
  void useToonMaterialProps('#e94560')

  // Load available models on mount
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
        // Fallback models
        setModels([
          { key: 'opus-4-6', id: 'anthropic/claude-opus-4-6', label: 'Opus 4-6', provider: 'anthropic' },
          { key: 'sonnet-4-5', id: 'anthropic/claude-sonnet-4-5', label: 'Sonnet 4.5', provider: 'anthropic' },
          { key: 'gpt-5-2', id: 'openai/gpt-5.2', label: 'GPT-5.2', provider: 'openai' },
        ])
      })
  }, [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (coreRef.current) {
      coreRef.current.position.y = 1.6 + Math.sin(t * 1.5) * 0.08
      coreRef.current.rotation.y = t * 0.8
      coreRef.current.rotation.x = Math.sin(t * 0.5) * 0.2
    }
    if (ringRef.current) {
      ringRef.current.rotation.y = t * 0.4
    }
  })

  const handleGenerate = async (prompt?: string) => {
    const text = (prompt || inputText).trim()
    if (!text || isGenerating) return

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

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
        const data = JSON.parse(e.data)
        addLine({ text: data.message, type: 'status' })
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
        const data = JSON.parse(e.data)
        addLine({ text: `💭 ${data.text}`, type: 'thinking' })
      })

      es.addEventListener('text', (e) => {
        const data = JSON.parse(e.data)
        addLine({ text: `📝 ${data.text}`, type: 'text' })
      })

      es.addEventListener('tool', (e) => {
        const data = JSON.parse(e.data)
        setToolCalls(prev => [...prev, { name: data.name, input: data.input || '' }])
        addLine({ text: data.message, type: 'tool' })
      })

      es.addEventListener('tool_result', (e) => {
        const data = JSON.parse(e.data)
        addLine({ text: data.message, type: 'tool_result' })
      })

      es.addEventListener('correction', (e) => {
        const data = JSON.parse(e.data)
        addLine({ text: data.message, type: 'correction' })
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
      setPreviewParts(null)
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    return () => { eventSourceRef.current?.close() }
  }, [])

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

      const now = Date.now()
      setGeneratedProps((prev) => [
        { name: previewName, filename: previewFilename, timestamp: now },
        ...prev,
      ].slice(0, 10))
      setSuccessMessage(`✅ "${previewName}" saved!`)

      onPropGenerated?.({
        name: previewName, filename: previewFilename,
        parts: previewParts, timestamp: now,
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

  const lastPromptRef = useRef('')
  lastPromptRef.current = lastPrompt
  const handleGenerateRef = useRef(handleGenerate)
  handleGenerateRef.current = handleGenerate

  const handleRegenerate = useCallback(() => {
    if (lastPromptRef.current) handleGenerateRef.current(lastPromptRef.current)
  }, [])

  const handleRetry = useCallback(() => {
    setRenderError(null)
    setError(null)
    if (lastPromptRef.current) handleGenerateRef.current(lastPromptRef.current)
  }, [])

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

  const PreviewComponent = previewParts ? createPartsPreviewComponent(previewParts) : null

  // ─── Tab Button Style ───────────────────────────────────────
  const tabBtn = (tab: TabId) => ({
    background: activeTab === tab ? 'hsl(var(--primary) / 0.15)' : 'transparent',
    border: `1px solid ${activeTab === tab ? 'hsl(var(--primary) / 0.4)' : border}`,
    borderRadius: '8px 8px 0 0',
    padding: '6px 14px',
    color: activeTab === tab ? primary : muted,
    fontWeight: activeTab === tab ? 700 : 400,
    fontSize: '12px',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? `2px solid ${primary}` : 'none',
  })

  return (
    <group
      position={position}
      rotation={[0, (rotation * Math.PI) / 180, 0]}
      onPointerOver={() => { setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); setDialogOpen(!dialogOpen) }}
    >
      {/* Machine geometry (unchanged) */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.8, 0.2, 6]} />
        <meshToonMaterial {...baseToon} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <torusGeometry args={[0.65, 0.03, 8, 6]} />
        <meshStandardMaterial
          color={hovered ? '#00ffcc' : '#0f3460'}
          emissive={hovered ? '#00ffcc' : '#0f3460'}
          emissiveIntensity={hovered ? 2 : 0.8}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.5, 0.9, 6]} />
        <meshToonMaterial {...panelToon} />
      </mesh>
      <group position={[0, 0.95, 0.3]} rotation={[-0.3, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.5, 0.3, 0.04]} />
          <meshToonMaterial {...trimToon} />
        </mesh>
        <mesh position={[0, 0, 0.021]}>
          <boxGeometry args={[0.42, 0.22, 0.01]} />
          <meshStandardMaterial
            color={isGenerating ? '#ffd700' : hovered ? '#00ffcc' : '#e94560'}
            emissive={isGenerating ? '#ffd700' : hovered ? '#00ffcc' : '#e94560'}
            emissiveIntensity={isGenerating ? 2 : hovered ? 1.5 : 0.6}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh ref={ringRef} position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.45, 0.02, 8, 32]} />
        <meshStandardMaterial
          color="#00ffcc" emissive="#00ffcc"
          emissiveIntensity={hovered ? 3 : 1.2}
          transparent opacity={hovered ? 0.9 : 0.5} toneMapped={false}
        />
      </mesh>
      <mesh ref={coreRef} position={[0, 1.6, 0]}>
        <octahedronGeometry args={[0.15, 0]} />
        <meshStandardMaterial
          color="#00ffcc" emissive="#00ffcc"
          emissiveIntensity={hovered ? 4 : 2}
          transparent opacity={0.85} toneMapped={false}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.55, 0, 0]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.12, 0.6, 0.12]} />
            <meshToonMaterial {...trimToon} />
          </mesh>
          {[0.2, 0.35, 0.5].map((y, i) => (
            <mesh key={i} position={[side * 0.061, y, 0]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial
                color={['#00ffcc', '#e94560', '#ffd700'][i]}
                emissive={['#00ffcc', '#e94560', '#ffd700'][i]}
                emissiveIntensity={1.5} toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
      <pointLight position={[0, 1.6, 0]} color="#00ffcc" intensity={hovered ? 3 : 1} distance={4} decay={2} />

      {/* Fullscreen Prop Maker */}
      {fullscreenOpen && (
        <Html>
          <FullscreenPropMaker
            onClose={() => setFullscreenOpen(false)}
            onPropGenerated={onPropGenerated}
          />
        </Html>
      )}

      {/* Dialog */}
      {dialogOpen && (
        <Html position={[0, 3.5, 0]} center zIndexRange={[100, 110]}>
          <div
            style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Main dialog */}
            <div style={{
              width: '600px',
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: '16px',
              padding: '20px',
              fontFamily: 'system-ui, sans-serif',
              color: fg,
              boxShadow: `0 0 30px hsl(var(--primary) / 0.15)`,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: primary }}>🔧 Prop Maker</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={() => { setFullscreenOpen(true); setDialogOpen(false) }}
                    style={{ background: 'none', border: `1px solid ${border}`, borderRadius: '4px', color: muted, fontSize: '14px', cursor: 'pointer', padding: '2px 6px' }}
                    title="Open fullscreen"
                  >⛶</button>
                  <button
                    onClick={() => setDialogOpen(false)}
                    style={{ background: 'none', border: 'none', color: muted, fontSize: '18px', cursor: 'pointer', padding: '0 4px' }}
                  >✕</button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                <button style={tabBtn('generate')} onClick={() => setActiveTab('generate')}>⚡ Generate</button>
                <button style={tabBtn('history')} onClick={() => setActiveTab('history')}>📋 History</button>
              </div>

              {/* Generate Tab */}
              {activeTab === 'generate' && (
                <>
                  <p style={{ fontSize: '13px', color: muted, margin: '0 0 12px 0', lineHeight: 1.5 }}>
                    Describe the prop you want. The AI fabricator will generate a 3D object.
                  </p>

                  {/* Model chooser */}
                  <ModelChooser
                    models={models}
                    selected={selectedModel}
                    onChange={setSelectedModel}
                    disabled={isGenerating}
                  />

                  {/* Examples */}
                  <div style={{ marginBottom: '10px' }}>
                    <button
                      onClick={() => setShowExamples(!showExamples)}
                      style={{
                        background: 'none', border: 'none', color: primary,
                        fontSize: '12px', cursor: 'pointer', padding: 0,
                        textDecoration: 'underline', opacity: 0.8,
                      }}
                    >
                      {showExamples ? 'Hide examples ▴' : 'Show examples ▾'}
                    </button>
                    {showExamples && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {examplePrompts.map((p) => (
                          <button
                            key={p}
                            onClick={() => { setInputText(p); setShowExamples(false) }}
                            style={{
                              background: 'hsl(var(--primary) / 0.1)',
                              border: '1px solid hsl(var(--primary) / 0.25)',
                              borderRadius: '12px', padding: '4px 10px',
                              color: muted, fontSize: '11px', cursor: 'pointer',
                            }}
                          >{p}</button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      placeholder="e.g. A glowing mushroom lamp with bioluminescent spots..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isGenerating}
                      rows={3}
                      style={{
                        width: '100%', background: 'hsl(var(--secondary))',
                        border: `1px solid ${border}`, borderRadius: '8px',
                        padding: '8px 12px', color: fg, fontSize: '13px',
                        outline: 'none', opacity: isGenerating ? 0.5 : 1,
                        resize: 'vertical', fontFamily: 'system-ui, sans-serif',
                      }}
                    />
                    <button
                      onClick={() => handleGenerate()}
                      disabled={isGenerating || !inputText.trim()}
                      style={{
                        background: isGenerating ? 'hsl(var(--muted))' : primary,
                        border: 'none', borderRadius: '8px', padding: '8px 14px',
                        color: 'hsl(var(--primary-foreground))', fontWeight: 600,
                        cursor: isGenerating ? 'wait' : 'pointer', fontSize: '13px', width: '100%',
                      }}
                    >
                      {isGenerating ? '⏳ Generating...' : '⚡ Create'}
                    </button>
                  </div>

                  {/* Status */}
                  {isGenerating && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'hsl(45 93% 58%)', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', animation: 'spin 2s linear infinite' }}>⚙️</span>
                      {' '}Fabricating with {previewModelLabel || selectedModel}...
                      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}
                  {successMessage && !isGenerating && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: primary, textAlign: 'center' }}>{successMessage}</div>
                  )}
                  {error && !isGenerating && !previewParts && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'hsl(var(--destructive))', textAlign: 'center' }}>
                      ❌ {error}
                      <div style={{ marginTop: '6px' }}>
                        <button
                          onClick={handleRetry}
                          style={{
                            background: 'hsl(var(--destructive) / 0.2)',
                            border: '1px solid hsl(var(--destructive) / 0.4)',
                            borderRadius: '6px', padding: '4px 12px',
                            color: 'hsl(var(--destructive))', fontSize: '11px', cursor: 'pointer',
                          }}
                        >🔄 Retry</button>
                      </div>
                    </div>
                  )}

                  {/* Method + model badge */}
                  {previewParts && (
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '6px' }}>
                      <span style={{
                        background: previewMethod === 'ai' ? 'hsl(var(--primary) / 0.15)' : 'hsl(45 93% 58% / 0.15)',
                        border: `1px solid ${previewMethod === 'ai' ? 'hsl(var(--primary) / 0.3)' : 'hsl(45 93% 58% / 0.3)'}`,
                        borderRadius: '12px', padding: '2px 10px', fontSize: '11px',
                        color: previewMethod === 'ai' ? primary : 'hsl(45 93% 58%)',
                      }}>
                        {previewMethod === 'ai' ? '🤖 AI' : '📐 Template'}
                      </span>
                      {previewModelLabel && (
                        <span style={{
                          background: 'hsl(var(--secondary))',
                          borderRadius: '12px', padding: '2px 10px', fontSize: '11px', color: muted,
                        }}>
                          {previewModelLabel}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Recent history */}
                  {generatedProps.length > 0 && (
                    <div style={{ marginTop: '14px', borderTop: `1px solid ${border}`, paddingTop: '10px' }}>
                      <div style={{ fontSize: '11px', color: muted, marginBottom: '6px' }}>Recent:</div>
                      {generatedProps.map((prop, i) => (
                        <div key={`${prop.filename}-${prop.timestamp}`} style={{ fontSize: '12px', color: muted, padding: '3px 0', opacity: 1 - i * 0.1 }}>
                          📦 {prop.name}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <HistoryPanel onLoadProp={handleLoadFromHistory} refreshKey={historyRefreshKey} />
              )}

              <div style={{ marginTop: '12px', fontSize: '11px', color: muted, textAlign: 'center' }}>
                ⚡ Powered by AI subagent
              </div>
            </div>

            {/* Preview Panel */}
            {(previewParts || isGenerating) && activeTab === 'generate' && (
              <PreviewPanel
                PropComponent={PreviewComponent}
                componentName={previewName || 'Generating...'}
                renderError={renderError}
                onApprove={handleApprove}
                onRegenerate={handleRegenerate}
                onRetry={handleRetry}
                isGenerating={isGenerating}
                isSaving={isSaving}
              />
            )}

            {/* Thinking Panel */}
            {(isGenerating || thinkingLines.length > 0) && activeTab === 'generate' && (
              <ThinkingPanel
                isGenerating={isGenerating}
                lines={thinkingLines}
                fullPrompt={fullPrompt}
                toolCalls={toolCalls}
              />
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

import { useState, useRef, useCallback, useEffect } from 'react'
import { useLightingConfig, useLightingPanelVisibility, type LightingConfig, type ShadowMapType } from '@/hooks/useLightingConfig'

// ─── Slider Component ───────────────────────────────────────────

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-14 shrink-0 truncate" title={label}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-blue-400"
        style={{ minWidth: 60 }}
      />
      <span className="text-[10px] text-gray-300 font-mono w-10 text-right">{step < 0.01 ? value.toFixed(4) : step < 0.1 ? value.toFixed(2) : value.toFixed(1)}</span>
    </div>
  )
}

// ─── Color Picker ───────────────────────────────────────────────

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-14 shrink-0 truncate" title={label}>{label}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-6 h-5 border-0 p-0 bg-transparent cursor-pointer rounded"
      />
      <span className="text-[10px] text-gray-400 font-mono">{value}</span>
    </div>
  )
}

// ─── Toggle ─────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 w-14 shrink-0">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={`w-8 h-4 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-gray-600'}`}
      >
        <div className={`w-3 h-3 rounded-full bg-white transition-transform mx-0.5 ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  )
}

// ─── Section Header ─────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mt-2 mb-1 border-b border-gray-700 pb-1">
      {title}
    </div>
  )
}

// ─── Tone Mapping Dropdown ──────────────────────────────────────

const TONE_OPTIONS: LightingConfig['toneMapping'][] = [
  'NoToneMapping',
  'ACESFilmicToneMapping',
  'ReinhardToneMapping',
  'CineonToneMapping',
]

const TONE_LABELS: Record<string, string> = {
  NoToneMapping: 'None',
  ACESFilmicToneMapping: 'ACES Filmic',
  ReinhardToneMapping: 'Reinhard',
  CineonToneMapping: 'Cineon',
}

// ─── Shadow Type Dropdown ────────────────────────────────────────

const SHADOW_TYPE_OPTIONS: ShadowMapType[] = [
  'BasicShadowMap',
  'PCFShadowMap',
  'PCFSoftShadowMap',
  'VSMShadowMap',
]

const SHADOW_TYPE_LABELS: Record<ShadowMapType, string> = {
  BasicShadowMap: 'Basic',
  PCFShadowMap: 'PCF',
  PCFSoftShadowMap: 'PCF Soft',
  VSMShadowMap: 'VSM',
}

const SHADOW_MAP_SIZES = [512, 1024, 2048, 4096]

// ─── Main Panel ─────────────────────────────────────────────────

export function LightingDebugPanel() {
  const { visible } = useLightingPanelVisibility()
  const { config, setConfig, resetConfig, importConfig, exportConfig } = useLightingConfig()

  // Minimize state
  const [minimized, setMinimized] = useState(false)

  // Dragging
  const [pos, setPos] = useState({ x: 16, y: 80 })
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y }
  }, [pos])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return
      setPos({
        x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
      })
    }
    const handleUp = () => { dragRef.current = null }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [])

  // Copy / Paste state
  const [copyLabel, setCopyLabel] = useState('📋 Copy JSON')
  const [pasteError, setPasteError] = useState('')

  const handleCopy = async () => {
    const json = exportConfig()
    try {
      // Try modern clipboard API first
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json)
      } else {
        // Fallback: textarea + execCommand for HTTP contexts
        const ta = document.createElement('textarea')
        ta.value = json
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopyLabel('✅ Copied!')
      setTimeout(() => setCopyLabel('📋 Copy JSON'), 1500)
    } catch {
      // Last resort: prompt with the JSON so user can manually copy
      window.prompt('Copy this lighting config:', json)
      setCopyLabel('📋 Copy JSON')
    }
  }

  const handlePaste = async () => {
    try {
      let text = ''
      if (navigator.clipboard?.readText) {
        text = await navigator.clipboard.readText()
      } else {
        // Fallback: prompt for paste
        text = window.prompt('Paste lighting config JSON:') || ''
      }
      if (!text) return
      if (importConfig(text)) {
        setPasteError('')
      } else {
        setPasteError('Invalid JSON')
        setTimeout(() => setPasteError(''), 2000)
      }
    } catch {
      // Fallback: prompt
      const text = window.prompt('Paste lighting config JSON:') || ''
      if (text && !importConfig(text)) {
        setPasteError('Invalid JSON')
        setTimeout(() => setPasteError(''), 2000)
      }
    }
  }

  // Helpers to update nested config
  const setAmbient = (patch: Partial<LightingConfig['ambient']>) =>
    setConfig(prev => ({ ...prev, ambient: { ...prev.ambient, ...patch } }))
  const setHemi = (patch: Partial<LightingConfig['hemisphere']>) =>
    setConfig(prev => ({ ...prev, hemisphere: { ...prev.hemisphere, ...patch } }))
  const setSun = (patch: Partial<LightingConfig['sun']>) =>
    setConfig(prev => ({ ...prev, sun: { ...prev.sun, ...patch } }))
  const setFill = (patch: Partial<LightingConfig['fill']>) =>
    setConfig(prev => ({ ...prev, fill: { ...prev.fill, ...patch } }))
  const setSunPos = (axis: 0 | 1 | 2, val: number) =>
    setConfig(prev => {
      const p = [...prev.sun.position] as [number, number, number]
      p[axis] = val
      return { ...prev, sun: { ...prev.sun, position: p } }
    })
  const setFillPos = (axis: 0 | 1 | 2, val: number) =>
    setConfig(prev => {
      const p = [...prev.fill.position] as [number, number, number]
      p[axis] = val
      return { ...prev, fill: { ...prev.fill, position: p } }
    })
  const setShadows = (patch: Partial<LightingConfig['shadows']>) =>
    setConfig(prev => ({ ...prev, shadows: { ...prev.shadows, ...patch } }))
  const setShadowCamera = (patch: Partial<LightingConfig['shadows']['camera']>) =>
    setConfig(prev => ({ ...prev, shadows: { ...prev.shadows, camera: { ...prev.shadows.camera, ...patch } } }))

  if (!visible) return null

  return (
    <div
      ref={panelRef}
      className="fixed z-[60] select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: 260,
        maxHeight: 'calc(100vh - 100px)',
      }}
    >
      <div className="bg-gray-900/90 backdrop-blur-md rounded-xl border border-gray-700/60 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
        {/* Header (drag handle) */}
        <div
          className="flex items-center justify-between px-3 py-2 cursor-move bg-gray-800/80 border-b border-gray-700/60"
          onMouseDown={handleMouseDown}
        >
          <span className="text-xs font-semibold text-gray-200">💡 Lighting Editor</span>
          <button
            onClick={() => setMinimized(m => !m)}
            className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-gray-700/60 transition-colors text-xs"
            title={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? '□' : '—'}
          </button>
        </div>

        {/* Scrollable content */}
        {!minimized && (
        <div className="overflow-y-auto p-3 space-y-1" style={{ maxHeight: 'calc(100vh - 180px)' }}>

          {/* ── Ambient ── */}
          <SectionHeader title="☀️ Ambient" />
          <Slider label="Intensity" value={config.ambient.intensity} min={0} max={3} step={0.1} onChange={v => setAmbient({ intensity: v })} />
          <ColorField label="Color" value={config.ambient.color} onChange={v => setAmbient({ color: v })} />

          {/* ── Hemisphere ── */}
          <SectionHeader title="🌗 Hemisphere" />
          <Slider label="Intensity" value={config.hemisphere.intensity} min={0} max={3} step={0.1} onChange={v => setHemi({ intensity: v })} />
          <ColorField label="Sky" value={config.hemisphere.skyColor} onChange={v => setHemi({ skyColor: v })} />
          <ColorField label="Ground" value={config.hemisphere.groundColor} onChange={v => setHemi({ groundColor: v })} />

          {/* ── Sun (Directional) ── */}
          <SectionHeader title="🌞 Sun (Directional)" />
          <Slider label="Intensity" value={config.sun.intensity} min={0} max={5} step={0.1} onChange={v => setSun({ intensity: v })} />
          <ColorField label="Color" value={config.sun.color} onChange={v => setSun({ color: v })} />
          <Slider label="Pos X" value={config.sun.position[0]} min={-50} max={50} step={1} onChange={v => setSunPos(0, v)} />
          <Slider label="Pos Y" value={config.sun.position[1]} min={-50} max={50} step={1} onChange={v => setSunPos(1, v)} />
          <Slider label="Pos Z" value={config.sun.position[2]} min={-50} max={50} step={1} onChange={v => setSunPos(2, v)} />
          <Toggle label="Shadows" checked={config.sun.castShadow} onChange={v => setSun({ castShadow: v })} />

          {/* ── Shadows ── */}
          <SectionHeader title="☁️ Shadows" />
          <Toggle label="Enabled" checked={config.shadows.enabled} onChange={v => setShadows({ enabled: v })} />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-14 shrink-0">Type</span>
            <select
              value={config.shadows.type}
              onChange={e => setShadows({ type: e.target.value as ShadowMapType })}
              className="flex-1 bg-gray-800 text-gray-200 text-[10px] rounded px-1.5 py-1 border border-gray-600"
            >
              {SHADOW_TYPE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{SHADOW_TYPE_LABELS[opt]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-14 shrink-0">Map Size</span>
            <select
              value={config.shadows.mapSize}
              onChange={e => setShadows({ mapSize: parseInt(e.target.value, 10) })}
              className="flex-1 bg-gray-800 text-gray-200 text-[10px] rounded px-1.5 py-1 border border-gray-600"
            >
              {SHADOW_MAP_SIZES.map(size => (
                <option key={size} value={size}>{size}×{size}</option>
              ))}
            </select>
          </div>
          <Slider label="Bias" value={config.shadows.bias} min={-0.005} max={0.005} step={0.0001} onChange={v => setShadows({ bias: v })} />
          <Slider label="N. Bias" value={config.shadows.normalBias} min={0} max={0.1} step={0.001} onChange={v => setShadows({ normalBias: v })} />
          {config.shadows.type === 'PCFSoftShadowMap' && (
            <Slider label="Radius" value={config.shadows.radius} min={0} max={10} step={0.1} onChange={v => setShadows({ radius: v })} />
          )}
          <Slider label="Darkness" value={config.shadows.darkness} min={0} max={1} step={0.05} onChange={v => setShadows({ darkness: v })} />
          <Slider label="Cam Near" value={config.shadows.camera.near} min={0.1} max={10} step={0.1} onChange={v => setShadowCamera({ near: v })} />
          <Slider label="Cam Far" value={config.shadows.camera.far} min={10} max={500} step={5} onChange={v => setShadowCamera({ far: v })} />
          <Slider label="Cam Size" value={config.shadows.camera.size} min={5} max={100} step={1} onChange={v => setShadowCamera({ size: v })} />

          {/* ── Fill Light ── */}
          <SectionHeader title="🔆 Fill Light" />
          <Slider label="Intensity" value={config.fill.intensity} min={0} max={3} step={0.1} onChange={v => setFill({ intensity: v })} />
          <ColorField label="Color" value={config.fill.color} onChange={v => setFill({ color: v })} />
          <Slider label="Pos X" value={config.fill.position[0]} min={-50} max={50} step={1} onChange={v => setFillPos(0, v)} />
          <Slider label="Pos Y" value={config.fill.position[1]} min={-50} max={50} step={1} onChange={v => setFillPos(1, v)} />
          <Slider label="Pos Z" value={config.fill.position[2]} min={-50} max={50} step={1} onChange={v => setFillPos(2, v)} />

          {/* ── Environment ── */}
          <SectionHeader title="🎬 Tone Mapping" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400 w-14 shrink-0">Type</span>
            <select
              value={config.toneMapping}
              onChange={e => setConfig({ toneMapping: e.target.value as LightingConfig['toneMapping'] })}
              className="flex-1 bg-gray-800 text-gray-200 text-[10px] rounded px-1.5 py-1 border border-gray-600"
            >
              {TONE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{TONE_LABELS[opt]}</option>
              ))}
            </select>
          </div>
          <Slider label="Exposure" value={config.toneMappingExposure} min={0} max={3} step={0.1} onChange={v => setConfig({ toneMappingExposure: v })} />
          <Slider label="Env Int." value={config.environmentIntensity} min={0} max={3} step={0.1} onChange={v => setConfig({ environmentIntensity: v })} />
        </div>
        )}

        {/* Footer buttons */}
        {!minimized && (
        <div className="border-t border-gray-700/60 p-2 flex flex-wrap gap-1.5">
          <button
            onClick={handleCopy}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            {copyLabel}
          </button>
          <button
            onClick={handlePaste}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
          >
            📥 Paste JSON
          </button>
          <button
            onClick={resetConfig}
            className="flex-1 text-[10px] px-2 py-1.5 rounded bg-red-900/50 hover:bg-red-800/60 text-red-300 transition-colors"
          >
            ↻ Reset
          </button>
          {pasteError && (
            <div className="w-full text-[9px] text-red-400 text-center">{pasteError}</div>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

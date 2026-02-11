/**
 * PropRefiner — Visual refinement panel for tweaking generated props.
 * Phase 2: Color picker, material presets, animation presets, component injection.
 */

import { useState, useCallback } from 'react'

interface RefinementOptions {
  components: { name: string; suggested: boolean; defaultColor: string }[]
  materialPresets: { name: string; label: string }[]
  animationPresets: { name: string; label: string; description: string }[]
  suggestedColors: string[]
}

interface PropRefinerProps {
  propName: string
  propId: string
  currentCode: string
  refinementOptions?: RefinementOptions | null
  onApplyChanges: (changes: RefineChanges) => void
  onReset: () => void
  disabled?: boolean
}

export interface RefineChanges {
  colorChanges: Record<string, string>
  addComponents: string[]
  animation?: string
  material?: string
}

const DEFAULT_PALETTE = [
  '#cc3333', '#3366cc', '#33aa33', '#ccaa33',
  '#aa44ff', '#00ffcc', '#ff4488', '#ffaa33',
  '#1a1a2e', '#ffffff', '#ff6644', '#00aaff',
]

const MATERIAL_PRESETS = [
  { name: 'solid', label: 'Solid', icon: '🟫' },
  { name: 'metallic', label: 'Metal', icon: '🔩' },
  { name: 'glowing', label: 'Glow', icon: '✨' },
  { name: 'glass', label: 'Glass', icon: '💎' },
]

const ANIMATION_PRESETS = [
  { name: 'rotate', label: 'Rotate', icon: '🔄' },
  { name: 'pulse', label: 'Pulse', icon: '💓' },
  { name: 'bob', label: 'Bob', icon: '🎈' },
  { name: 'sway', label: 'Sway', icon: '🌊' },
]

const INJECTABLE_COMPONENTS = [
  { name: 'LED', label: '+LED', icon: '💡' },
  { name: 'SteamParticles', label: '+Steam', icon: '♨️' },
  { name: 'GlowOrb', label: '+Glow', icon: '🔮' },
  { name: 'Screen', label: '+Screen', icon: '🖥️' },
  { name: 'DataStream', label: '+Data', icon: '📊' },
]

export function PropRefiner({
  propName,
  propId,
  currentCode,
  refinementOptions,
  onApplyChanges,
  onReset,
  disabled = false,
}: PropRefinerProps) {
  const [selectedColor, setSelectedColor] = useState<string | null>(null)
  const [replaceColor, setReplaceColor] = useState<string>('')
  const [colorChanges, setColorChanges] = useState<Record<string, string>>({})
  const [addedComponents, setAddedComponents] = useState<string[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)
  const [selectedAnimation, setSelectedAnimation] = useState<string | null>(null)

  // Extract colors used in the current code
  const usedColors = Array.from(
    new Set(
      (currentCode.match(/#[0-9a-fA-F]{6}/g) || []).map(c => c.toLowerCase())
    )
  ).slice(0, 8)

  const palette = refinementOptions?.suggestedColors || DEFAULT_PALETTE

  const handleColorSwap = useCallback((oldColor: string, newColor: string) => {
    setColorChanges(prev => ({ ...prev, [oldColor]: newColor }))
  }, [])

  const handleToggleComponent = useCallback((comp: string) => {
    setAddedComponents(prev =>
      prev.includes(comp)
        ? prev.filter(c => c !== comp)
        : [...prev, comp]
    )
  }, [])

  const handleApply = useCallback(() => {
    onApplyChanges({
      colorChanges,
      addComponents: addedComponents,
      animation: selectedAnimation || undefined,
      material: selectedMaterial || undefined,
    })
  }, [colorChanges, addedComponents, selectedAnimation, selectedMaterial, onApplyChanges])

  const handleReset = useCallback(() => {
    setColorChanges({})
    setAddedComponents([])
    setSelectedMaterial(null)
    setSelectedAnimation(null)
    setSelectedColor(null)
    setReplaceColor('')
    onReset()
  }, [onReset])

  const hasChanges = Object.keys(colorChanges).length > 0 ||
    addedComponents.length > 0 ||
    selectedMaterial !== null ||
    selectedAnimation !== null

  return (
    <div className="pr-container">
      <div className="pr-header">
        🎨 Refine: {propName}
      </div>

      {/* Color Section */}
      <div className="pr-section">
        <div className="pr-section-label">Colors in Prop</div>
        <div className="pr-color-row">
          {usedColors.map(c => (
            <button
              key={c}
              className={`pr-color-swatch ${selectedColor === c ? 'pr-color-selected' : ''}`}
              style={{ background: colorChanges[c] || c }}
              onClick={() => setSelectedColor(selectedColor === c ? null : c)}
              title={c}
              disabled={disabled}
            />
          ))}
        </div>

        {selectedColor && (
          <>
            <div className="pr-section-label" style={{ marginTop: 8 }}>
              Replace <span style={{ color: selectedColor }}>■</span> with:
            </div>
            <div className="pr-color-row">
              {palette.map(c => (
                <button
                  key={c}
                  className="pr-color-swatch pr-color-option"
                  style={{ background: c }}
                  onClick={() => handleColorSwap(selectedColor, c)}
                  title={c}
                  disabled={disabled}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Material Presets */}
      <div className="pr-section">
        <div className="pr-section-label">Material</div>
        <div className="pr-preset-row">
          {MATERIAL_PRESETS.map(m => (
            <button
              key={m.name}
              className={`pr-preset-btn ${selectedMaterial === m.name ? 'pr-preset-active' : ''}`}
              onClick={() => setSelectedMaterial(selectedMaterial === m.name ? null : m.name)}
              disabled={disabled}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Animation Presets */}
      <div className="pr-section">
        <div className="pr-section-label">Animation</div>
        <div className="pr-preset-row">
          {ANIMATION_PRESETS.map(a => (
            <button
              key={a.name}
              className={`pr-preset-btn ${selectedAnimation === a.name ? 'pr-preset-active' : ''}`}
              onClick={() => setSelectedAnimation(selectedAnimation === a.name ? null : a.name)}
              disabled={disabled}
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Component Injection */}
      <div className="pr-section">
        <div className="pr-section-label">Add Details</div>
        <div className="pr-preset-row">
          {INJECTABLE_COMPONENTS.map(c => {
            const suggested = refinementOptions?.components?.find(
              rc => rc.name === c.name
            )?.suggested
            return (
              <button
                key={c.name}
                className={`pr-preset-btn ${addedComponents.includes(c.name) ? 'pr-preset-active' : ''} ${suggested ? 'pr-preset-suggested' : ''}`}
                onClick={() => handleToggleComponent(c.name)}
                disabled={disabled}
              >
                {c.icon} {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pr-actions">
        <button
          className="pr-apply-btn"
          onClick={handleApply}
          disabled={disabled || !hasChanges}
        >
          ✅ Apply Changes
        </button>
        <button
          className="pr-reset-btn"
          onClick={handleReset}
          disabled={disabled}
        >
          ↩️ Reset
        </button>
      </div>

      {!hasChanges && (
        <div className="pr-hint">Select options above to refine your prop</div>
      )}

      <style>{propRefinerStyles}</style>
    </div>
  )
}

const propRefinerStyles = `
.pr-container {
  background: var(--zen-bg-panel, #1a1a2e);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 10px;
  padding: 12px;
  margin-top: 12px;
}
.pr-header {
  font-size: 13px;
  font-weight: 700;
  color: var(--zen-accent, #6366f1);
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--zen-border, #2a2a4a);
}
.pr-section {
  margin-bottom: 10px;
}
.pr-section-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--zen-fg-dim, #888);
  margin-bottom: 6px;
}
.pr-color-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pr-color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.pr-color-swatch:hover {
  transform: scale(1.15);
  border-color: rgba(255,255,255,0.3);
}
.pr-color-selected {
  border-color: var(--zen-accent, #6366f1) !important;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}
.pr-color-option {
  width: 24px;
  height: 24px;
  border-radius: 4px;
}
.pr-preset-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.pr-preset-btn {
  background: var(--zen-bg, #0f0f23);
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px;
  padding: 5px 10px;
  color: var(--zen-fg-dim, #888);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.pr-preset-btn:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: rgba(99, 102, 241, 0.3);
}
.pr-preset-active {
  background: rgba(99, 102, 241, 0.15) !important;
  border-color: var(--zen-accent, #6366f1) !important;
  color: var(--zen-accent, #6366f1) !important;
}
.pr-preset-suggested {
  border-color: rgba(34, 197, 94, 0.3);
}
.pr-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.pr-apply-btn {
  flex: 1;
  background: var(--zen-accent, #6366f1);
  border: none;
  border-radius: 8px;
  padding: 8px;
  color: white;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}
.pr-apply-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pr-reset-btn {
  background: transparent;
  border: 1px solid var(--zen-border, #2a2a4a);
  border-radius: 8px;
  padding: 8px 14px;
  color: var(--zen-fg-dim, #888);
  font-size: 12px;
  cursor: pointer;
}
.pr-hint {
  text-align: center;
  font-size: 11px;
  color: var(--zen-fg-muted, #555);
  margin-top: 8px;
}
`

/**
 * PropControls — Left-side control panel for FullscreenPropMaker.
 * Contains the tab bar (Generate / History / Advanced) and all tab content:
 * generate form, quality score, iteration panel, visual refinement, part editor,
 * style transfer, and the generation history tab.
 */

import React from 'react'
import type { PropPart } from './DynamicProp'
import { PropRefiner, type RefineChanges } from './PropRefiner'
import { GenerationHistory } from './GenerationHistory'
import type {
  ModelOption,
  GenerationRecord,
  TabId,
  TransformMode,
  GenerationMode,
} from './propMakerTypes'

// ── Props ─────────────────────────────────────────────────────

export interface PropControlsProps {
  // Tab state
  readonly activeTab: TabId
  readonly onTabChange: (tab: TabId) => void

  // Demo
  readonly isDemoMode: boolean

  // Input / generation
  readonly inputText: string
  readonly onInputChange: (value: string) => void
  readonly isGenerating: boolean
  readonly onGenerate: () => void
  readonly onRegenerate: () => void
  readonly onRetry: () => void
  readonly error: string | null

  // Model selection
  readonly models: ModelOption[]
  readonly selectedModel: string
  readonly onModelChange: (model: string) => void

  // Generation mode
  readonly generationMode: GenerationMode
  readonly onGenerationModeChange: (mode: GenerationMode) => void
  readonly templateBase: string
  readonly onTemplateBaseChange: (base: string) => void
  readonly availableTemplates: { id: string; name: string }[]

  // Examples
  readonly showExamples: boolean
  readonly onToggleExamples: () => void
  readonly onSelectExample: (prompt: string) => void

  // Preview state (needed for badges + action buttons)
  readonly previewParts: PropPart[] | null
  readonly previewMethod: 'ai' | 'template'
  readonly previewModelLabel: string
  readonly previewName: string
  readonly previewCode: string
  readonly renderError: string | null
  readonly isSaving: boolean
  readonly onApprove: () => void

  // Part editor
  readonly editMode: boolean
  readonly onToggleEditMode: () => void
  readonly selectedPartIndex: number | null
  readonly transformMode: TransformMode
  readonly onTransformModeChange: (mode: TransformMode) => void
  readonly onApplyPartEdits: () => void

  // Quality score
  readonly qualityScore: any | null

  // Iteration
  readonly iterationFeedback: string
  readonly onIterationFeedbackChange: (v: string) => void
  readonly isIterating: boolean
  readonly onIterate: () => void
  readonly iterationHistory: { version: number; feedback: string; score: number; code: string }[]
  readonly onRollback: (version: number) => void

  // Refinement (Phase 2)
  readonly generationId: string
  readonly refinementOptions: any | null
  readonly isRefining: boolean
  readonly onRefine: (changes: RefineChanges) => void
  readonly onRefineReset: () => void

  // Style transfer (Advanced tab)
  readonly availableStyles: { id: string; name: string; palette: string[] }[]
  readonly selectedStyle: string
  readonly onStyleChange: (style: string) => void
  readonly isApplyingStyle: boolean
  readonly onApplyStyle: () => void

  // History tab
  readonly historyRefreshKey: number
  readonly onLoadFromHistory: (record: GenerationRecord) => void
}

// ── Example Prompts ───────────────────────────────────────────

const EXAMPLE_PROMPTS = [
  'A glowing mushroom lamp',
  'A steampunk gear clock',
  'A floating crystal orb',
  'A retro arcade cabinet',
  'A neon "OPEN" sign',
  'A tiny robot figurine',
]

// ── Component ─────────────────────────────────────────────────

export function PropControls({
  activeTab,
  onTabChange,
  isDemoMode,
  inputText,
  onInputChange,
  isGenerating,
  onGenerate,
  onRegenerate,
  onRetry,
  error,
  models,
  selectedModel,
  onModelChange,
  generationMode,
  onGenerationModeChange,
  templateBase,
  onTemplateBaseChange,
  availableTemplates,
  showExamples,
  onToggleExamples,
  onSelectExample,
  previewParts,
  previewMethod,
  previewModelLabel,
  previewName,
  previewCode,
  renderError,
  isSaving,
  onApprove,
  editMode,
  onToggleEditMode,
  selectedPartIndex,
  transformMode,
  onTransformModeChange,
  onApplyPartEdits,
  qualityScore,
  iterationFeedback,
  onIterationFeedbackChange,
  isIterating,
  onIterate,
  iterationHistory,
  onRollback,
  generationId,
  refinementOptions,
  isRefining,
  onRefine,
  onRefineReset,
  availableStyles,
  selectedStyle,
  onStyleChange,
  isApplyingStyle,
  onApplyStyle,
  historyRefreshKey,
  onLoadFromHistory,
}: PropControlsProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onGenerate()
    }
  }

  let generateBtnLabel: string
  if (isDemoMode) {
    generateBtnLabel = '⚠️ Generate (Demo)'
  } else if (isGenerating) {
    generateBtnLabel = '⏳ Generating...'
  } else {
    generateBtnLabel = '⚡ Create'
  }

  return (
    <div className="fpm-controls">
      <div className="fpm-controls-scroll">
        {/* Tabs */}
        <div className="fpm-tabs">
          <button
            className={`fpm-tab ${activeTab === 'generate' ? 'fpm-tab-active' : ''}`}
            onClick={() => onTabChange('generate')}
          >
            ⚡ Generate
          </button>
          <button
            className={`fpm-tab ${activeTab === 'history' ? 'fpm-tab-active' : ''}`}
            onClick={() => onTabChange('history')}
          >
            📋 History
          </button>
          <button
            className={`fpm-tab ${activeTab === 'advanced' ? 'fpm-tab-active' : ''}`}
            onClick={() => onTabChange('advanced')}
          >
            🧬 Advanced
          </button>
        </div>

        {/* ── Generate Tab ─────────────────────────────────── */}
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
                onChange={(e) => onModelChange(e.target.value)}
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
              <button className="fpm-examples-toggle" onClick={onToggleExamples}>
                {showExamples ? 'Hide examples ▴' : 'Show examples ▾'}
              </button>
              {showExamples && (
                <div className="fpm-examples-grid">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button key={p} className="fpm-example-btn" onClick={() => onSelectExample(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Generation mode & template */}
            <div className="fpm-model-row">
              <label className="fpm-label">Mode:</label>
              <select
                value={generationMode}
                onChange={(e) => onGenerationModeChange(e.target.value as GenerationMode)}
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
                  onChange={(e) => onTemplateBaseChange(e.target.value)}
                  disabled={isGenerating}
                  className="fpm-select"
                >
                  <option value="">None (enhanced AI)</option>
                  {availableTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Prompt input */}
            <textarea
              className="fpm-textarea"
              placeholder="e.g. A glowing mushroom lamp with bioluminescent spots..."
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              rows={3}
            />
            <button
              className="fpm-create-btn"
              onClick={onGenerate}
              disabled={isDemoMode || isGenerating || !inputText.trim()}
              title={isDemoMode ? 'Not available in demo mode' : undefined}
            >
              {generateBtnLabel}
            </button>

            {/* Error */}
            {error && !isGenerating && !previewParts && (
              <div className="fpm-error">
                ❌ {error}
                <button className="fpm-retry-btn" onClick={onRetry}>
                  🔄 Retry
                </button>
              </div>
            )}

            {/* Method badges */}
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

            {/* Approve / Regenerate */}
            {previewParts && !isGenerating && (
              <div className="fpm-action-row">
                <button
                  className="fpm-approve-btn"
                  onClick={onApprove}
                  disabled={isSaving || !!renderError}
                >
                  {isSaving ? '💾 Saving...' : '✅ Approve & Save'}
                </button>
                <button className="fpm-regen-btn" onClick={onRegenerate}>
                  🔄 Regenerate
                </button>
              </div>
            )}

            {/* Part Editor */}
            {previewParts && !isGenerating && (
              <div className="fpm-part-editor">
                <div className="fpm-part-editor-header">
                  <span>✏️ Part Editor</span>
                  <button
                    className={`fpm-edit-toggle ${editMode ? 'fpm-edit-toggle-active' : ''}`}
                    onClick={onToggleEditMode}
                  >
                    {editMode ? '🔓 Exit Edit' : '🔒 Edit Parts'}
                  </button>
                </div>
                {editMode && (
                  <div className="fpm-part-editor-controls">
                    <div className="fpm-transform-modes">
                      {(['translate', 'rotate', 'scale'] as const).map((mode) => (
                        <button
                          key={mode}
                          className={`fpm-transform-btn ${transformMode === mode ? 'fpm-transform-btn-active' : ''}`}
                          onClick={() => onTransformModeChange(mode)}
                        >
                          {(() => {
                            if (mode === 'translate') return '↔️ Move'
                            if (mode === 'rotate') return '🔄 Rotate'
                            return '📐 Scale'
                          })()}
                        </button>
                      ))}
                    </div>
                    {selectedPartIndex === null ? (
                      <div className="fpm-selected-part-info" style={{ opacity: 0.5 }}>
                        Click a part in the preview to select it
                      </div>
                    ) : (
                      <div className="fpm-selected-part-info">
                        Selected: Part {selectedPartIndex + 1} (
                        {previewParts[selectedPartIndex]?.type})
                        <span
                          style={{ color: previewParts[selectedPartIndex]?.color, marginLeft: 6 }}
                        >
                          ■
                        </span>
                      </div>
                    )}
                    <button className="fpm-apply-edits-btn" onClick={onApplyPartEdits}>
                      ✅ Apply Part Changes
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Quality Score */}
            {qualityScore && !isGenerating && (
              <div className="fpm-quality-panel">
                <div className="fpm-quality-header">
                  Quality: {qualityScore.overall}/100
                  {(() => {
                    if (qualityScore.overall >= 85) return ' 🌟'
                    if (qualityScore.overall >= 70) return ' ✨'
                    return ' 💫'
                  })()}
                </div>
                <div className="fpm-quality-bars">
                  {[
                    { label: 'Composition', value: qualityScore.composition_score },
                    { label: 'Color', value: qualityScore.color_score },
                    { label: 'Animation', value: qualityScore.animation_score },
                    { label: 'Detail', value: qualityScore.detail_score },
                    { label: 'Style', value: qualityScore.style_consistency },
                  ].map(({ label, value }) => {
                    let barColor: string
                    if (value >= 80) {
                      barColor = '#22c55e'
                    } else if (value >= 50) {
                      barColor = '#eab308'
                    } else {
                      barColor = '#ef4444'
                    }
                    return (
                      <div key={label} className="fpm-quality-bar-row">
                        <span className="fpm-quality-bar-label">{label}</span>
                        <div className="fpm-quality-bar-track">
                          <div
                            className="fpm-quality-bar-fill"
                            style={{
                              width: `${value}%`,
                              background: barColor,
                            }}
                          />
                        </div>
                        <span className="fpm-quality-bar-value">{value}</span>
                      </div>
                    )
                  })}
                </div>
                {qualityScore.suggestions?.length > 0 && (
                  <div className="fpm-quality-suggestions">
                    {qualityScore.suggestions.map((s: string, i: number) => (
                      <div key={`item-${i}`} className="fpm-quality-suggestion">
                        💡 {s}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Visual Refinement (Phase 2) */}
            {previewParts && previewCode && !isGenerating && (
              <PropRefiner
                propName={previewName}
                propId={generationId}
                currentCode={previewCode}
                refinementOptions={refinementOptions}
                onApplyChanges={onRefine}
                onReset={onRefineReset}
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
                    onChange={(e) => onIterationFeedbackChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onIterate()
                    }}
                    disabled={isIterating}
                  />
                  <button
                    className="fpm-iteration-btn"
                    onClick={onIterate}
                    disabled={isIterating || !iterationFeedback.trim()}
                  >
                    {isIterating ? '⏳' : '✨'}
                  </button>
                </div>
                {iterationHistory.length > 0 && (
                  <div className="fpm-iteration-history">
                    {iterationHistory.map((h) => (
                      <div key={h.version} className="fpm-iteration-entry">
                        <span>
                          v{h.version}: "{h.feedback}" (Score: {h.score})
                        </span>
                        <button
                          className="fpm-iteration-rollback"
                          onClick={() => onRollback(h.version)}
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

        {/* ── History Tab ───────────────────────────────────── */}
        {activeTab === 'history' && (
          <GenerationHistory onLoadProp={onLoadFromHistory} refreshKey={historyRefreshKey} />
        )}

        {/* ── Advanced Tab ──────────────────────────────────── */}
        {activeTab === 'advanced' && (
          <div className="fpm-advanced">
            {/* Style Transfer */}
            <div className="fpm-advanced-section">
              <div className="fpm-advanced-title">🎨 Style Transfer</div>
              <p className="fpm-description">
                Apply a showcase prop's visual style to your current prop.
              </p>
              <div className="fpm-model-row">
                <label className="fpm-label">Style:</label>
                <select
                  value={selectedStyle}
                  onChange={(e) => onStyleChange(e.target.value)}
                  className="fpm-select"
                  disabled={isApplyingStyle || !previewCode}
                >
                  <option value="">Select style...</option>
                  {availableStyles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {selectedStyle && (
                <div className="fpm-style-palette">
                  {availableStyles
                    .find((s) => s.id === selectedStyle)
                    ?.palette.map((c, i) => (
                      <div
                        key={`c-${i}`}
                        className="fpm-style-swatch"
                        style={{ background: c }}
                        title={c}
                      />
                    ))}
                </div>
              )}
              <button
                className="fpm-create-btn"
                onClick={onApplyStyle}
                disabled={!selectedStyle || !previewCode || isApplyingStyle}
                style={{ marginTop: 8 }}
              >
                {isApplyingStyle ? '⏳ Applying...' : '🎨 Apply Style'}
              </button>
            </div>

            {/* Prop Genetics placeholder */}
            <div className="fpm-advanced-section">
              <div className="fpm-advanced-title">🧬 Prop Genetics</div>
              <p className="fpm-description">
                Combine traits from two props to create unique hybrids. Use the API endpoint{' '}
                <code>/api/creator/props/crossbreed</code> for programmatic access.
              </p>
              <div className="fpm-advanced-hint">
                💡 Coming soon to the UI — available now via API
              </div>
            </div>

            {/* Quality Tips */}
            <div className="fpm-advanced-section">
              <div className="fpm-advanced-title">💡 Quality Tips</div>
              <div className="fpm-quality-tips">
                <div>
                  • Use <strong>Hybrid mode</strong> with a template base for best results
                </div>
                <div>
                  • <strong>Iterate</strong> with feedback to improve score by 10-20 points
                </div>
                <div>
                  • Apply <strong>style transfer</strong> from a showcase prop for consistent
                  quality
                </div>
                <div>
                  • Aim for <strong>85+</strong> quality score for showcase-grade props
                </div>
                <div>
                  • Try <strong>"add blinking lights"</strong> or <strong>"more colorful"</strong>{' '}
                  as feedback
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

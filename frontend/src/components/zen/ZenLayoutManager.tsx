/**
 * Zen Layout Manager
 * Save, load, and manage named layout presets
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { type LayoutNode, type LayoutPreset, getAllPanels } from './types/layout'

// ── Types ─────────────────────────────────────────────────────────

export interface SavedLayout {
  id: string
  name: string
  description?: string
  layout: LayoutNode
  createdAt: number
  updatedAt: number
}

interface LayoutSummary {
  panelTypes: string[]
  panelCount: number
}

// ── Storage Keys ──────────────────────────────────────────────────

const STORAGE_KEY = 'zen-saved-layouts'
const RECENT_LAYOUTS_KEY = 'zen-recent-layouts'
const CURRENT_LAYOUT_KEY = 'zen-current-layout'

// ── Storage Functions ─────────────────────────────────────────────

export function getSavedLayouts(): SavedLayout[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function saveLayoutToStorage(layout: SavedLayout): void {
  try {
    const layouts = getSavedLayouts()
    const existingIndex = layouts.findIndex((l) => l.id === layout.id)

    if (existingIndex >= 0) {
      layouts[existingIndex] = { ...layout, updatedAt: Date.now() }
    } else {
      layouts.push(layout)
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
  } catch {
    console.error('Failed to save layout')
  }
}

export function deleteLayoutFromStorage(layoutId: string): void {
  try {
    const layouts = getSavedLayouts().filter((l) => l.id !== layoutId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
  } catch {
    console.error('Failed to delete layout')
  }
}

export function saveCurrentLayout(layout: LayoutNode): void {
  try {
    localStorage.setItem(
      CURRENT_LAYOUT_KEY,
      JSON.stringify({
        layout,
        savedAt: Date.now(),
      })
    )
  } catch {
    console.error('Failed to save current layout')
  }
}

export function loadCurrentLayout(): LayoutNode | null {
  try {
    const data = localStorage.getItem(CURRENT_LAYOUT_KEY)
    if (!data) return null
    const parsed = JSON.parse(data)
    return parsed.layout || null
  } catch {
    return null
  }
}

export function addRecentLayout(presetOrId: LayoutPreset | string): void {
  try {
    const recent = getRecentLayouts()
    const filtered = recent.filter((id) => id !== presetOrId)
    filtered.unshift(presetOrId)
    // Keep only last 5
    localStorage.setItem(RECENT_LAYOUTS_KEY, JSON.stringify(filtered.slice(0, 5)))
  } catch {
    console.error('Failed to add recent layout')
  }
}

export function getRecentLayouts(): string[] {
  try {
    const data = localStorage.getItem(RECENT_LAYOUTS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

// ── Helper Functions ──────────────────────────────────────────────

function generateLayoutId(): string {
  return `layout-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

function getLayoutSummary(layout: LayoutNode): LayoutSummary {
  const panels = getAllPanels(layout)
  const panelTypes = [...new Set(panels.map((p) => p.panelType))]
  return {
    panelTypes,
    panelCount: panels.length,
  }
}

// ── Save Layout Modal ─────────────────────────────────────────────

interface ZenSaveLayoutModalProps {
  readonly layout: LayoutNode
  readonly onClose: () => void
  readonly onSave: (savedLayout: SavedLayout) => void
  readonly existingLayout?: SavedLayout
}

export function ZenSaveLayoutModal({
  layout,
  onClose,
  onSave,
  existingLayout,
}: ZenSaveLayoutModalProps) {
  const [name, setName] = useState(existingLayout?.name || '')
  const [description, setDescription] = useState(existingLayout?.description || '')
  const [isSaving, setIsSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const summary = useMemo(() => getLayoutSummary(layout), [layout])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Enter' && !e.shiftKey && name.trim()) {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [name, onClose])

  const handleSave = useCallback(async () => {
    if (!name.trim()) return

    setIsSaving(true)
    try {
      const savedLayout: SavedLayout = {
        id: existingLayout?.id || generateLayoutId(),
        name: name.trim(),
        description: description.trim() || undefined,
        layout,
        createdAt: existingLayout?.createdAt || Date.now(),
        updatedAt: Date.now(),
      }

      saveLayoutToStorage(savedLayout)
      onSave(savedLayout)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }, [name, description, layout, existingLayout, onSave, onClose])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  return (
    <div // NOSONAR: backdrop div closes modal on click; role='dialog' conveys semantic purpose
      className="zen-save-layout-backdrop"
      onClick={handleBackdropClick}

      aria-modal="true"
      aria-label="Save Layout"
     role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click() } }}>
      <div className="zen-save-layout-modal">
        <header className="zen-save-layout-header">
          <h2 className="zen-save-layout-title">
            <span className="zen-save-layout-icon">💾</span>
            {existingLayout ? 'Update Layout' : 'Save Layout'}
          </h2>
          <button className="zen-btn zen-btn-icon zen-btn-close" onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        <div className="zen-save-layout-content">
          {/* Preview */}
          <div className="zen-save-layout-preview">
            <div className="zen-save-layout-preview-label">Layout Preview</div>
            <div className="zen-save-layout-preview-info">
              <span className="zen-badge">{summary.panelCount} panels</span>
              {summary.panelTypes.map((type) => (
                <span key={type} className="zen-badge">
                  {type}
                </span>
              ))}
            </div>
          </div>

          {/* Name Input */}
          <div className="zen-save-layout-field">
            <label className="zen-save-layout-label" htmlFor="layout-name">
              Name <span className="zen-required">*</span>
            </label>
            <input
              ref={inputRef}
              id="layout-name"
              type="text"
              className="zen-save-layout-input"
              placeholder="e.g., 'Dev Setup' or 'Monitoring'"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Description Input */}
          <div className="zen-save-layout-field">
            <label className="zen-save-layout-label" htmlFor="layout-desc">
              Description <span className="zen-optional">(optional)</span>
            </label>
            <textarea
              id="layout-desc"
              className="zen-save-layout-textarea"
              placeholder="Brief description of this layout..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
            />
          </div>
        </div>

        <footer className="zen-save-layout-footer">
          <div className="zen-save-layout-hints">
            <span>
              <kbd className="zen-kbd">Enter</kbd> save
            </span>
            <span>
              <kbd className="zen-kbd">Esc</kbd> cancel
            </span>
          </div>
          <div className="zen-save-layout-actions">
            <button className="zen-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="zen-btn zen-btn-primary"
              onClick={handleSave}
              disabled={!name.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <span className="zen-spinner" /> Saving...
                </>
              ) : (
                <>
                  <span>💾</span>
                  {existingLayout ? 'Update' : 'Save'}
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ── Layout Picker Modal ───────────────────────────────────────────

interface ZenLayoutPickerProps {
  readonly currentPreset?: LayoutPreset
  readonly onClose: () => void
  readonly onSelectPreset: (preset: LayoutPreset) => void
  readonly onSelectSaved: (layout: SavedLayout) => void
  readonly onDeleteSaved: (layoutId: string) => void
}

const PRESET_DESCRIPTIONS: Record<
  LayoutPreset,
  { name: string; description: string; icon: string }
> = {
  default: {
    name: 'Default',
    description: 'Sessions + Chat + Activity',
    icon: '📋',
  },
  'multi-chat': {
    name: 'Multi-Chat',
    description: 'Two chat panels side by side',
    icon: '💬',
  },
  monitor: {
    name: 'Monitor',
    description: 'Sessions + Activity feed',
    icon: '📊',
  },
}

export function ZenLayoutPicker({
  currentPreset,
  onClose,
  onSelectPreset,
  onSelectSaved,
  onDeleteSaved,
}: ZenLayoutPickerProps) {
  const [selectedTab, setSelectedTab] = useState<'presets' | 'saved'>('presets')
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>([])
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  // Load saved layouts
  useEffect(() => {
    setSavedLayouts(getSavedLayouts())
  }, [])

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (confirmDelete) {
          setConfirmDelete(null)
        } else {
          onClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [confirmDelete, onClose])

  const handleDelete = useCallback(
    (layoutId: string) => {
      if (confirmDelete === layoutId) {
        deleteLayoutFromStorage(layoutId)
        setSavedLayouts((layouts) => layouts.filter((l) => l.id !== layoutId))
        onDeleteSaved(layoutId)
        setConfirmDelete(null)
      } else {
        setConfirmDelete(layoutId)
      }
    },
    [confirmDelete, onDeleteSaved]
  )

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  return (
    <div // NOSONAR: backdrop div closes modal on click; role='dialog' conveys semantic purpose
      className="zen-layout-picker-backdrop"
      onClick={handleBackdropClick}

      aria-modal="true"
      aria-label="Choose Layout"
     role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLElement).click() } }}>
      <div className="zen-layout-picker-modal">
        <header className="zen-layout-picker-header">
          <h2 className="zen-layout-picker-title">
            <span className="zen-layout-picker-icon">📐</span>
            Choose Layout
          </h2>
          <button className="zen-btn zen-btn-icon zen-btn-close" onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        {/* Tabs */}
        <div className="zen-layout-picker-tabs">
          <button
            className={`zen-layout-picker-tab ${selectedTab === 'presets' ? 'zen-layout-picker-tab-active' : ''}`}
            onClick={() => setSelectedTab('presets')}
          >
            <span>📋</span> Presets
          </button>
          <button
            className={`zen-layout-picker-tab ${selectedTab === 'saved' ? 'zen-layout-picker-tab-active' : ''}`}
            onClick={() => setSelectedTab('saved')}
          >
            <span>💾</span> Saved
            {savedLayouts.length > 0 && (
              <span className="zen-badge zen-badge-small">{savedLayouts.length}</span>
            )}
          </button>
        </div>

        <div className="zen-layout-picker-content">
          {selectedTab === 'presets' ? (
            <div className="zen-layout-picker-list">
              {(Object.keys(PRESET_DESCRIPTIONS) as LayoutPreset[]).map((preset) => {
                const info = PRESET_DESCRIPTIONS[preset]
                const isCurrent = preset === currentPreset

                return (
                  <button
                    key={preset}
                    className={`zen-layout-picker-item ${isCurrent ? 'zen-layout-picker-item-current' : ''}`}
                    onClick={() => {
                      onSelectPreset(preset)
                      onClose()
                    }}
                  >
                    <span className="zen-layout-picker-item-icon">{info.icon}</span>
                    <div className="zen-layout-picker-item-info">
                      <span className="zen-layout-picker-item-name">
                        {info.name}
                        {isCurrent && <span className="zen-badge zen-badge-accent">Current</span>}
                      </span>
                      <span className="zen-layout-picker-item-desc">{info.description}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="zen-layout-picker-list">
              {savedLayouts.length === 0 ? (
                <div className="zen-layout-picker-empty">
                  <span className="zen-layout-picker-empty-icon">📁</span>
                  <span className="zen-layout-picker-empty-text">No saved layouts</span>
                  <span className="zen-layout-picker-empty-hint">
                    Use <kbd className="zen-kbd">Ctrl+Shift+S</kbd> to save your current layout
                  </span>
                </div>
              ) : (
                savedLayouts.map((layout) => {
                  const summary = getLayoutSummary(layout.layout)
                  const isConfirmingDelete = confirmDelete === layout.id

                  return (
                    <div key={layout.id} className="zen-layout-picker-saved-item">
                      <button
                        className="zen-layout-picker-item"
                        onClick={() => {
                          onSelectSaved(layout)
                          onClose()
                        }}
                      >
                        <span className="zen-layout-picker-item-icon">📐</span>
                        <div className="zen-layout-picker-item-info">
                          <span className="zen-layout-picker-item-name">{layout.name}</span>
                          <span className="zen-layout-picker-item-desc">
                            {layout.description ||
                              `${summary.panelCount} panels: ${summary.panelTypes.join(', ')}`}
                          </span>
                        </div>
                      </button>
                      <button
                        className={`zen-btn zen-btn-icon zen-layout-picker-delete ${isConfirmingDelete ? 'zen-layout-picker-delete-confirm' : ''}`}
                        onClick={() => handleDelete(layout.id)}
                        title={isConfirmingDelete ? 'Click again to confirm' : 'Delete layout'}
                      >
                        {isConfirmingDelete ? '⚠️' : '🗑️'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        <footer className="zen-layout-picker-footer">
          <span>
            <kbd className="zen-kbd">Esc</kbd> close
          </span>
        </footer>
      </div>
    </div>
  )
}

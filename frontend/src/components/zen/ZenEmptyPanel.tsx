/**
 * Zen Empty Panel
 * Enhanced panel type selector — reads from PanelRegistry
 */

import { type PanelType } from './types/layout'
import { getPrimaryPanelDefs, getSecondaryPanelDefs } from './registry'

interface ZenEmptyPanelProps {
  readonly onSelectPanelType?: (type: PanelType) => void
}

export function ZenEmptyPanel({ onSelectPanelType }: ZenEmptyPanelProps) {
  const primaryPanels = getPrimaryPanelDefs()
  const secondaryPanels = getSecondaryPanelDefs()

  return (
    <div className="zen-empty-panel">
      <div className="zen-empty-header">
        <div className="zen-empty-icon">+</div>
        <div className="zen-empty-title">Add Panel</div>
        <div className="zen-empty-subtitle">Choose a panel type to display</div>
      </div>

      {onSelectPanelType && (
        <div className="zen-panel-selector">
          {/* Main panel types */}
          <div className="zen-panel-grid">
            {primaryPanels.map((def) => (
              <button
                key={def.id}
                className="zen-panel-option"
                onClick={() => onSelectPanelType(def.id)}
                title={def.description}
              >
                <div className="zen-panel-option-icon">{def.icon}</div>
                <div className="zen-panel-option-content">
                  <span className="zen-panel-option-label">{def.label}</span>
                  <span className="zen-panel-option-desc">{def.description}</span>
                </div>
                {def.shortcutHint && <kbd className="zen-panel-option-kbd">{def.shortcutHint}</kbd>}
              </button>
            ))}
          </div>

          {/* Additional types */}
          {secondaryPanels.length > 0 && (
            <div className="zen-panel-additional">
              <div className="zen-panel-additional-title">More</div>
              <div className="zen-panel-additional-grid">
                {secondaryPanels.map((def) => (
                  <button
                    key={def.id}
                    className="zen-panel-option zen-panel-option-small"
                    onClick={() => onSelectPanelType(def.id)}
                    title={def.description}
                  >
                    <span className="zen-panel-option-icon">{def.icon}</span>
                    <span className="zen-panel-option-label">{def.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="zen-empty-footer">
        <span className="zen-empty-hint">
          Press <kbd className="zen-kbd">Ctrl+K</kbd> to open command palette
        </span>
      </div>
    </div>
  )
}

/**
 * Zen Empty Panel
 * Placeholder panel for empty splits
 */

import { type PanelType, PANEL_INFO } from './types/layout'

interface ZenEmptyPanelProps {
  onSelectPanelType?: (type: PanelType) => void
}

const AVAILABLE_TYPES: PanelType[] = ['chat', 'sessions', 'activity']

export function ZenEmptyPanel({ onSelectPanelType }: ZenEmptyPanelProps) {
  return (
    <div className="zen-empty-panel">
      <div className="zen-empty-icon">◻️</div>
      <div className="zen-empty-title">Empty Panel</div>
      
      {onSelectPanelType && (
        <div className="zen-empty-actions">
          <div className="zen-empty-subtitle">Add a panel:</div>
          <div className="zen-empty-buttons">
            {AVAILABLE_TYPES.map(type => {
              const info = PANEL_INFO[type]
              return (
                <button
                  key={type}
                  className="zen-btn zen-empty-btn"
                  onClick={() => onSelectPanelType(type)}
                >
                  <span className="zen-empty-btn-icon">{info.icon}</span>
                  <span>{info.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

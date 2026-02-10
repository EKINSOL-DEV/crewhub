/**
 * Zen Empty Panel
 * Enhanced panel type selector with all available types
 */

import { type PanelType, PANEL_INFO } from './types/layout'

interface ZenEmptyPanelProps {
  onSelectPanelType?: (type: PanelType) => void
}

// All available panel types (excluding 'empty' and 'details')
const AVAILABLE_TYPES: { type: PanelType; shortcut?: string; description: string }[] = [
  { 
    type: 'chat', 
    shortcut: 'c',
    description: 'Chat with an agent' 
  },
  { 
    type: 'sessions', 
    shortcut: 's',
    description: 'View active sessions' 
  },
  { 
    type: 'activity', 
    shortcut: 'a',
    description: 'Real-time event stream' 
  },
  { 
    type: 'rooms', 
    shortcut: 'r',
    description: 'Browse and filter rooms' 
  },
  { 
    type: 'tasks', 
    shortcut: 't',
    description: 'Task board overview' 
  },
  { 
    type: 'kanban', 
    shortcut: 'k',
    description: 'Kanban board view' 
  },
  { 
    type: 'logs', 
    shortcut: 'l',
    description: 'System logs viewer' 
  },
]

// Additional panel types without shortcuts
const ADDITIONAL_TYPES: { type: PanelType; description: string }[] = [
  { 
    type: 'cron' as PanelType, 
    description: 'Scheduled cron jobs'
  },
  {
    type: 'documents' as PanelType,
    description: 'Browse project documents'
  },
]

export function ZenEmptyPanel({ onSelectPanelType }: ZenEmptyPanelProps) {
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
            {AVAILABLE_TYPES.map(({ type, shortcut, description }) => {
              const info = PANEL_INFO[type]
              return (
                <button
                  key={type}
                  className="zen-panel-option"
                  onClick={() => onSelectPanelType(type)}
                  title={description}
                >
                  <div className="zen-panel-option-icon">{info.icon}</div>
                  <div className="zen-panel-option-content">
                    <span className="zen-panel-option-label">{info.label}</span>
                    <span className="zen-panel-option-desc">{description}</span>
                  </div>
                  {shortcut && (
                    <kbd className="zen-panel-option-kbd">{shortcut}</kbd>
                  )}
                </button>
              )
            })}
          </div>
          
          {/* Additional types */}
          <div className="zen-panel-additional">
            <div className="zen-panel-additional-title">More</div>
            <div className="zen-panel-additional-grid">
              {ADDITIONAL_TYPES.map(({ type, description }) => {
                // Use a fallback for types not in PANEL_INFO
                const info = PANEL_INFO[type] || { icon: '⏰', label: 'Cron' }
                return (
                  <button
                    key={type}
                    className="zen-panel-option zen-panel-option-small"
                    onClick={() => onSelectPanelType(type)}
                    title={description}
                  >
                    <span className="zen-panel-option-icon">{info.icon}</span>
                    <span className="zen-panel-option-label">{info.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
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

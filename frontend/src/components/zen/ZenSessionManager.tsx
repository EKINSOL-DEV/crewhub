/**
 * Zen Session Manager
 * Agent picker and session details for Zen Mode.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────

interface AgentOption {
  id: string
  name: string
  icon: string
  description: string
  model?: string
}

// Available agents
const AVAILABLE_AGENTS: AgentOption[] = [
  {
    id: 'main',
    name: 'Main Agent',
    icon: '🧠',
    description: 'Primary assistant for general tasks',
    model: 'claude-sonnet',
  },
  {
    id: 'dev',
    name: 'Dev Agent',
    icon: '💻',
    description: 'Development and coding tasks',
    model: 'claude-opus',
  },
  {
    id: 'research',
    name: 'Research Agent',
    icon: '🔍',
    description: 'Web research and analysis',
    model: 'claude-sonnet',
  },
  {
    id: 'writer',
    name: 'Writer Agent',
    icon: '✍️',
    description: 'Content creation and editing',
    model: 'claude-sonnet',
  },
]

// ── Session Details Panel ─────────────────────────────────────────

interface SessionDetailsProps {
  readonly sessionKey: string
  readonly onClose: () => void
  readonly onKill: (sessionKey: string) => void
}

export function ZenSessionDetails({ sessionKey, onClose, onKill }: SessionDetailsProps) {
  const [isKilling, setIsKilling] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)

  const handleKill = useCallback(() => {
    if (!confirmKill) {
      setConfirmKill(true)
      return
    }

    setIsKilling(true)
    try {
      onKill(sessionKey)
      onClose()
    } finally {
      setIsKilling(false)
    }
  }, [confirmKill, sessionKey, onKill, onClose])

  // Parse session key for display
  const sessionParts = useMemo(() => {
    const parts = sessionKey.split(':')
    return {
      type: parts[0] || 'unknown',
      kind: parts[1] || 'unknown',
      id: parts.slice(2).join(':') || sessionKey,
    }
  }, [sessionKey])

  return (
    <div className="zen-session-details">
      <header className="zen-session-details-header">
        <h3 className="zen-session-details-title">Session Details</h3>
        <button className="zen-btn zen-btn-icon" onClick={onClose} title="Close details">
          ✕
        </button>
      </header>

      <div className="zen-session-details-content">
        <div className="zen-session-details-row">
          <span className="zen-session-details-label">Type</span>
          <span className="zen-session-details-value">{sessionParts.type}</span>
        </div>
        <div className="zen-session-details-row">
          <span className="zen-session-details-label">Kind</span>
          <span className="zen-session-details-value">{sessionParts.kind}</span>
        </div>
        <div className="zen-session-details-row">
          <span className="zen-session-details-label">Session ID</span>
          <code className="zen-session-details-code">{sessionParts.id}</code>
        </div>
      </div>

      <footer className="zen-session-details-footer">
        <button
          className={`zen-btn zen-session-kill-btn ${confirmKill ? 'zen-session-kill-confirm' : ''}`}
          onClick={handleKill}
          disabled={isKilling}
        >
          {isKilling ? (
            <>
              <span className="zen-spinner" /> Terminating...
            </>
          ) : confirmKill ? (
            <>
              <span>⚠️</span> Click again to confirm
            </>
          ) : (
            <>
              <span>🛑</span> Terminate Session
            </>
          )}
        </button>
      </footer>
    </div>
  )
}

// ── Agent Picker (Quick Modal) ────────────────────────────────────

interface ZenAgentPickerProps {
  readonly onClose: () => void
  readonly onSelect: (agentId: string, agentName: string, agentIcon: string) => void
  readonly agents?: AgentOption[]
}

export function ZenAgentPicker({
  onClose,
  onSelect,
  agents = AVAILABLE_AGENTS,
}: ZenAgentPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter agents by query
  const filteredAgents = useMemo(() => {
    if (!query.trim()) return agents
    const q = query.toLowerCase()
    return agents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    )
  }, [agents, query])

  // Focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onClose()
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filteredAgents.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filteredAgents[selectedIndex]) {
            const agent = filteredAgents[selectedIndex]
            onSelect(agent.id, agent.name, agent.icon)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [filteredAgents, selectedIndex, onSelect, onClose])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

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
      className="zen-picker-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Select Agent"
    >
      <div className="zen-picker-modal">
        <div className="zen-picker-search">
          <span className="zen-picker-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="zen-picker-input"
            placeholder="Search agents..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="zen-picker-list">
          {filteredAgents.length === 0 ? (
            <div className="zen-picker-empty">No agents found</div>
          ) : (
            filteredAgents.map((agent, index) => (
              <button
                key={agent.id}
                className={`zen-picker-item ${index === selectedIndex ? 'zen-picker-item-selected' : ''}`}
                onClick={() => onSelect(agent.id, agent.name, agent.icon)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="zen-picker-item-icon">{agent.icon}</span>
                <div className="zen-picker-item-info">
                  <span className="zen-picker-item-name">{agent.name}</span>
                  <span className="zen-picker-item-desc">{agent.description}</span>
                </div>
                {agent.model && <span className="zen-picker-item-model">{agent.model}</span>}
              </button>
            ))
          )}
        </div>

        <div className="zen-picker-footer">
          <span>
            <kbd className="zen-kbd">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="zen-kbd">Enter</kbd> select
          </span>
          <span>
            <kbd className="zen-kbd">Esc</kbd> cancel
          </span>
        </div>
      </div>
    </div>
  )
}

export { AVAILABLE_AGENTS }
export type { AgentOption }

/**
 * Zen Session Manager
 * Modal for spawning new agent sessions and managing existing ones
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

// Available agents to spawn
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

// ── Spawn Modal ───────────────────────────────────────────────────

interface ZenSpawnModalProps {
  onClose: () => void
  onSpawn: (agentId: string, label?: string) => void
}

export function ZenSpawnModal({ onClose, onSpawn }: ZenSpawnModalProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [isSpawning, setIsSpawning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }
      
      if (e.key === 'Enter' && selectedAgent) {
        e.preventDefault()
        handleSpawn()
      }
      
      // Number keys to select agent
      const num = parseInt(e.key)
      if (num >= 1 && num <= AVAILABLE_AGENTS.length) {
        e.preventDefault()
        setSelectedAgent(AVAILABLE_AGENTS[num - 1].id)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [selectedAgent, onClose])
  
  const handleSpawn = useCallback(async () => {
    if (!selectedAgent) return
    
    setIsSpawning(true)
    try {
      await onSpawn(selectedAgent, label || undefined)
      onClose()
    } finally {
      setIsSpawning(false)
    }
  }, [selectedAgent, label, onSpawn, onClose])
  
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])
  
  return (
    <div 
      className="zen-spawn-backdrop"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Spawn New Agent"
    >
      <div className="zen-spawn-modal">
        <header className="zen-spawn-header">
          <h2 className="zen-spawn-title">
            <span className="zen-spawn-title-icon">🚀</span>
            Spawn New Agent Session
          </h2>
          <button
            className="zen-btn zen-btn-icon zen-btn-close"
            onClick={onClose}
            title="Close"
          >
            ✕
          </button>
        </header>
        
        <div className="zen-spawn-content">
          {/* Agent Selection */}
          <div className="zen-spawn-section">
            <label className="zen-spawn-label">Select Agent</label>
            <div className="zen-spawn-agents">
              {AVAILABLE_AGENTS.map((agent, index) => (
                <button
                  key={agent.id}
                  className={`zen-spawn-agent ${selectedAgent === agent.id ? 'zen-spawn-agent-selected' : ''}`}
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  <span className="zen-spawn-agent-icon">{agent.icon}</span>
                  <div className="zen-spawn-agent-info">
                    <span className="zen-spawn-agent-name">{agent.name}</span>
                    <span className="zen-spawn-agent-desc">{agent.description}</span>
                  </div>
                  <kbd className="zen-kbd zen-spawn-agent-kbd">{index + 1}</kbd>
                </button>
              ))}
            </div>
          </div>
          
          {/* Optional Label */}
          <div className="zen-spawn-section">
            <label className="zen-spawn-label" htmlFor="spawn-label">
              Session Label <span className="zen-spawn-optional">(optional)</span>
            </label>
            <input
              ref={inputRef}
              id="spawn-label"
              type="text"
              className="zen-spawn-input"
              placeholder="e.g., 'Fix login bug' or 'Research competitors'"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>
        
        <footer className="zen-spawn-footer">
          <div className="zen-spawn-hints">
            <span><kbd className="zen-kbd">1-4</kbd> select agent</span>
            <span><kbd className="zen-kbd">Enter</kbd> spawn</span>
            <span><kbd className="zen-kbd">Esc</kbd> cancel</span>
          </div>
          <div className="zen-spawn-actions">
            <button
              className="zen-btn zen-spawn-btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="zen-btn zen-spawn-btn-spawn"
              onClick={handleSpawn}
              disabled={!selectedAgent || isSpawning}
            >
              {isSpawning ? (
                <>
                  <span className="zen-spinner" />
                  Spawning...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  Spawn Session
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ── Session Details Panel ─────────────────────────────────────────

interface SessionDetailsProps {
  sessionKey: string
  onClose: () => void
  onKill: (sessionKey: string) => void
}

export function ZenSessionDetails({ sessionKey, onClose, onKill }: SessionDetailsProps) {
  const [isKilling, setIsKilling] = useState(false)
  const [confirmKill, setConfirmKill] = useState(false)
  
  const handleKill = useCallback(async () => {
    if (!confirmKill) {
      setConfirmKill(true)
      return
    }
    
    setIsKilling(true)
    try {
      await onKill(sessionKey)
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
        <button
          className="zen-btn zen-btn-icon"
          onClick={onClose}
          title="Close details"
        >
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
              <span className="zen-spinner" />
              Terminating...
            </>
          ) : confirmKill ? (
            <>
              <span>⚠️</span>
              Click again to confirm
            </>
          ) : (
            <>
              <span>🛑</span>
              Terminate Session
            </>
          )}
        </button>
      </footer>
    </div>
  )
}

// ── Agent Picker (Quick Modal) ────────────────────────────────────

interface ZenAgentPickerProps {
  onClose: () => void
  onSelect: (agentId: string, agentName: string, agentIcon: string) => void
  agents?: AgentOption[]
}

export function ZenAgentPicker({ onClose, onSelect, agents = AVAILABLE_AGENTS }: ZenAgentPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Filter agents by query
  const filteredAgents = useMemo(() => {
    if (!query.trim()) return agents
    const q = query.toLowerCase()
    return agents.filter(a => 
      a.name.toLowerCase().includes(q) || 
      a.description.toLowerCase().includes(q)
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
          setSelectedIndex(i => Math.min(i + 1, filteredAgents.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(i => Math.max(i - 1, 0))
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
  
  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])
  
  return (
    <div 
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
                {agent.model && (
                  <span className="zen-picker-item-model">{agent.model}</span>
                )}
              </button>
            ))
          )}
        </div>
        
        <div className="zen-picker-footer">
          <span><kbd className="zen-kbd">↑↓</kbd> navigate</span>
          <span><kbd className="zen-kbd">Enter</kbd> select</span>
          <span><kbd className="zen-kbd">Esc</kbd> cancel</span>
        </div>
      </div>
    </div>
  )
}

export { AVAILABLE_AGENTS }
export type { AgentOption }

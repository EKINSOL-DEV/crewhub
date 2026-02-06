import { useState, useEffect } from 'react'
import type { Task } from '@/hooks/useTasks'

interface Agent {
  id: string
  name: string
  description?: string
  emoji?: string
}

interface SpawnAgentDialogProps {
  task: Task
  isOpen: boolean
  onClose: () => void
  onSpawn: (agentId: string, sessionKey: string) => void
}

export function SpawnAgentDialog({ task, isOpen, onClose, onSpawn }: SpawnAgentDialogProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [extraInstructions, setExtraInstructions] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSpawning, setIsSpawning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch agents when dialog opens
  useEffect(() => {
    if (isOpen) {
      fetchAgents()
    }
  }, [isOpen])

  const fetchAgents = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/agents')
      if (!response.ok) throw new Error('Failed to fetch agents')
      const data = await response.json()
      setAgents(data.agents || [])
      // Select first agent by default
      if (data.agents?.length > 0 && !selectedAgentId) {
        setSelectedAgentId(data.agents[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSpawn = async () => {
    if (!selectedAgentId) {
      setError('Please select an agent')
      return
    }

    setIsSpawning(true)
    setError(null)

    try {
      const response = await fetch(`/api/tasks/${task.id}/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: selectedAgentId,
          extra_instructions: extraInstructions.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.detail || 'Failed to spawn agent')
      }

      const data = await response.json()
      onSpawn(selectedAgentId, data.session_key)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to spawn agent')
    } finally {
      setIsSpawning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 24,
          width: '90%',
          maxWidth: 480,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#1f2937' }}>
            🚀 Run with Agent
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#9ca3af',
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        {/* Task Info */}
        <div
          style={{
            background: '#f9fafb',
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>Task:</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#1f2937' }}>{task.title}</div>
          {task.description && (
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{task.description}</div>
          )}
        </div>

        {/* Agent Selection */}
        <div style={{ marginBottom: 16 }}>
          <label
            htmlFor="agent-select"
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}
          >
            Select Agent
          </label>
          {isLoading ? (
            <div style={{ color: '#6b7280', fontSize: 13 }}>Loading agents...</div>
          ) : (
            <select
              id="agent-select"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 14,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="">-- Select an agent --</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.emoji || '🤖'} {agent.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Extra Instructions */}
        <div style={{ marginBottom: 20 }}>
          <label
            htmlFor="extra-instructions"
            style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}
          >
            Extra Instructions (optional)
          </label>
          <textarea
            id="extra-instructions"
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            placeholder="Add any additional context or instructions for the agent..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '10px 12px',
              marginBottom: 16,
              color: '#dc2626',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSpawn}
            disabled={isSpawning || !selectedAgentId}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: isSpawning || !selectedAgentId ? '#9ca3af' : '#2563eb',
              color: '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor: isSpawning || !selectedAgentId ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {isSpawning ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                Spawning...
              </>
            ) : (
              <>🚀 Spawn Agent</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

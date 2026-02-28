/**
 * ProjectAgentsPanel — agent templates per room.
 * Shows in the room focus view, allowing users to define and start agents.
 */

import { useState, useEffect, useCallback } from 'react'

const API = '/api/rooms'

interface ProjectAgent {
  id: string
  room_id: string
  name: string
  cwd: string
  startup_prompt: string
  created_at: number
}

interface Props {
  readonly roomId: string
}

export function ProjectAgentsPanel({ roomId }: Props) {
  const [agents, setAgents] = useState<ProjectAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [startingId, setStartingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', cwd: '', startup_prompt: '' })

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch(`${API}/${roomId}/agents`)
      const data = await res.json()
      setAgents(data.agents || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const handleCreate = async () => {
    if (!form.name || !form.cwd || !form.startup_prompt) return
    try {
      const res = await fetch(`${API}/${roomId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setForm({ name: '', cwd: '', startup_prompt: '' })
        setShowForm(false)
        fetchAgents()
      }
    } catch {
      // ignore
    }
  }

  const handleDelete = async (agentId: string) => {
    await fetch(`${API}/${roomId}/agents/${agentId}`, { method: 'DELETE' })
    fetchAgents()
  }

  const handleStart = async (agentId: string) => {
    setStartingId(agentId)
    try {
      const res = await fetch(`${API}/${roomId}/agents/${agentId}/start`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        console.log('Agent started:', data)
      }
    } catch {
      // ignore
    } finally {
      setTimeout(() => setStartingId(null), 2000)
    }
  }

  const shortenCwd = (cwd: string) => {
    const parts = cwd.split('/')
    return parts.length > 3 ? `…/${parts.slice(-2).join('/')}` : cwd
  }

  if (loading) return null

  return (
    <div
      className="zen-agents-panel"
      style={{ borderTop: '1px solid var(--zen-border)', padding: '8px 12px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--zen-fg-muted)' }}>
          🤖 Agents
        </span>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'var(--zen-bg-hover)',
            border: 'none',
            color: 'var(--zen-fg)',
            cursor: 'pointer',
          }}
        >
          {showForm ? '✕' : '+ Add'}
        </button>
      </div>

      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{
              fontSize: 12,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid var(--zen-border)',
              background: 'var(--zen-bg)',
              color: 'var(--zen-fg)',
            }}
          />
          <input
            placeholder="Working directory"
            value={form.cwd}
            onChange={(e) => setForm({ ...form, cwd: e.target.value })}
            style={{
              fontSize: 12,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid var(--zen-border)',
              background: 'var(--zen-bg)',
              color: 'var(--zen-fg)',
            }}
          />
          <textarea
            placeholder="Startup prompt"
            value={form.startup_prompt}
            onChange={(e) => setForm({ ...form, startup_prompt: e.target.value })}
            rows={2}
            style={{
              fontSize: 12,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid var(--zen-border)',
              background: 'var(--zen-bg)',
              color: 'var(--zen-fg)',
              resize: 'vertical',
            }}
          />
          <button
            onClick={handleCreate}
            style={{
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 4,
              background: 'var(--zen-accent)',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Create Agent
          </button>
        </div>
      )}

      {agents.length === 0 && !showForm && (
        <div style={{ fontSize: 11, color: 'var(--zen-fg-muted)', padding: '4px 0' }}>
          No agent templates defined
        </div>
      )}

      {agents.map((agent) => (
        <div
          key={agent.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 0',
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 500 }}>{agent.name}</div>
            <div
              style={{
                fontSize: 10,
                color: 'var(--zen-fg-muted)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {shortenCwd(agent.cwd)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
            <button
              onClick={() => handleStart(agent.id)}
              disabled={startingId === agent.id}
              title="Start agent"
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                background: startingId === agent.id ? '#666' : '#22c55e',
                border: 'none',
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              {startingId === agent.id ? 'Starting…' : '▶'}
            </button>
            <button
              onClick={() => handleDelete(agent.id)}
              title="Delete"
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                background: 'var(--zen-bg-hover)',
                border: 'none',
                color: 'var(--zen-fg-muted)',
                cursor: 'pointer',
              }}
            >
              🗑
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

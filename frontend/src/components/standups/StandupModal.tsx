import { useState, useEffect } from 'react'
import { useStandups } from '@/hooks/useStandups'
import { API_BASE } from '@/lib/api'

interface Agent {
  id: string
  name: string
  icon: string | null
  color: string | null
}

interface StandupModalProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly onComplete?: () => void
}

type Step = 'select' | 'entries' | 'done'

export function StandupModal({ open, onClose, onComplete }: StandupModalProps) {
  const { createStandup, submitEntry } = useStandups()
  const [agents, setAgents] = useState<Agent[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<Step>('select')
  const [standupId, setStandupId] = useState<string | null>(null)
  const [title, setTitle] = useState('Daily Standup')
  const [currentAgent, setCurrentAgent] = useState(0)
  const [yesterday, setYesterday] = useState('')
  const [today, setToday] = useState('')
  const [blockers, setBlockers] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<string[]>([])

  // Fetch agents
  useEffect(() => {
    if (!open) return
    fetch(`${API_BASE}/agents`)
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.agents)
        setSelected(new Set(d.agents.map((a: Agent) => a.id)))
      })
      .catch(console.error)
  }, [open])

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('select')
      setStandupId(null)
      setTitle('Daily Standup')
      setCurrentAgent(0)
      setYesterday('')
      setToday('')
      setBlockers('')
      setSubmitting(false)
      setSubmitted([])
    }
  }, [open])

  if (!open) return null

  const selectedAgents = agents.filter((a) => selected.has(a.id))
  const agent = selectedAgents[currentAgent]

  const toggleAgent = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const handleStart = async () => {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      const data = await createStandup(title, Array.from(selected))
      setStandupId(data.id)
      setStep('entries')
      setCurrentAgent(0)
      clearFields()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const clearFields = () => {
    setYesterday('')
    setToday('')
    setBlockers('')
  }

  const handleSubmitEntry = async () => {
    if (!standupId || !agent) return
    setSubmitting(true)
    try {
      await submitEntry(standupId, agent.id, yesterday, today, blockers)
      setSubmitted((prev) => [...prev, agent.id])
      if (currentAgent < selectedAgents.length - 1) {
        setCurrentAgent((prev) => prev + 1)
        clearFields()
      } else {
        setStep('done')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    onClose()
    onComplete?.()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          width: 480,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            🗓️{' '}
            {step === 'done'
              ? 'Standup Complete!'
              : step === 'entries'
                ? `Entry: ${agent?.name}`
                : 'Start Stand-Up'}
          </h2>
          <button
            onClick={handleClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#9ca3af',
            }}
          >
            ✕
          </button>
        </div>

        {/* Step 1: Agent Selection */}
        {step === 'select' && (
          <>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />

            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Participants</label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: 8,
                marginBottom: 16,
              }}
            >
              {agents.map((a) => (
                <label
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selected.has(a.id) ? 'rgba(79,70,229,0.06)' : 'transparent',
                    border: `1px solid ${selected.has(a.id) ? 'rgba(79,70,229,0.2)' : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(a.id)}
                    onChange={() => toggleAgent(a.id)}
                    style={{ accentColor: a.color || '#4f46e5' }}
                  />
                  <span style={{ fontSize: 16 }}>{a.icon || '🤖'}</span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{a.name}</span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={handleClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleStart}
                disabled={selected.size === 0 || submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background:
                    selected.size === 0 ? '#d1d5db' : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Creating...' : `Start (${selected.size} agents)`}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Entry Submission */}
        {step === 'entries' && agent && (
          <>
            {/* Progress */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
              {selectedAgents.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background:
                      i < currentAgent
                        ? a.color || '#4f46e5'
                        : i === currentAgent
                          ? '#d1d5db'
                          : '#f3f4f6',
                    transition: 'background 0.3s',
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <span
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: agent.color || '#4f46e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                }}
              >
                {agent.icon || '🤖'}
              </span>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{agent.name}</span>
              <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>
                {currentAgent + 1}/{selectedAgents.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Yesterday</label>
                <textarea
                  value={yesterday}
                  onChange={(e) => setYesterday(e.target.value)}
                  placeholder="What did you work on yesterday?"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>Today</label>
                <textarea
                  value={today}
                  onChange={(e) => setToday(e.target.value)}
                  placeholder="What will you work on today?"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>Blockers</label>
                <textarea
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  placeholder="Any blockers? (leave empty if none)"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    fontSize: 13,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={handleSubmitEntry}
                disabled={submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {submitting
                  ? 'Saving...'
                  : currentAgent < selectedAgents.length - 1
                    ? 'Next →'
                    : 'Finish ✓'}
              </button>
            </div>
          </>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 15, color: '#374151', margin: '0 0 8px' }}>
              Stand-up recorded with <strong>{submitted.length}</strong> entries
            </p>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 20px' }}>
              Check the history to review all entries
            </p>
            <button
              onClick={handleClose}
              style={{
                padding: '8px 24px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

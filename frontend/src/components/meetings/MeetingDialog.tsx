/**
 * MeetingDialog — Configuration dialog for starting a new AI meeting.
 *
 * Participant picker (multi-select from agents in room), goal input,
 * round count, editable round topics, auto-detected project.
 */

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AgentRuntime } from '@/hooks/useAgentsRegistry'
import type { StartMeetingParams } from '@/hooks/useMeeting'

// ─── Default round topics ───────────────────────────────────────

const DEFAULT_TOPICS = [
  'What have you been working on?',
  'What will you focus on next?',
  'Any blockers, risks, or things you need help with?',
  'Open discussion',
  'Wrap-up and action items',
]

// ─── Types ──────────────────────────────────────────────────────

interface MeetingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: AgentRuntime[]
  roomId?: string
  projectId?: string
  projectName?: string
  onStart: (params: StartMeetingParams) => Promise<void>
  /** Whether a meeting is already in progress */
  meetingInProgress?: boolean
  onViewProgress?: () => void
}

// ─── Component ──────────────────────────────────────────────────

export function MeetingDialog({
  open,
  onOpenChange,
  agents,
  roomId,
  projectId,
  projectName,
  onStart,
  meetingInProgress = false,
  onViewProgress,
}: MeetingDialogProps) {
  const [goal, setGoal] = useState('')
  const [numRounds, setNumRounds] = useState(3)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [topics, setTopics] = useState<string[]>(DEFAULT_TOPICS.slice(0, 3))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Available agents (only those with a session key, i.e., existing agents)
  const availableAgents = useMemo(
    () => agents.filter(a => a.agent.agent_session_key),
    [agents]
  )

  // Initialize selected agents when dialog opens
  const prevOpenRef = useState(false)
  if (open && !prevOpenRef[0]) {
    const allKeys = new Set(availableAgents.map(a => a.agent.agent_session_key!))
    setSelectedAgents(allKeys)
    setGoal('')
    setNumRounds(3)
    setTopics(DEFAULT_TOPICS.slice(0, 3))
    setError(null)
  }
  prevOpenRef[0] = open

  const toggleAgent = (key: string) => {
    setSelectedAgents(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedAgents.size === availableAgents.length) {
      setSelectedAgents(new Set())
    } else {
      setSelectedAgents(new Set(availableAgents.map(a => a.agent.agent_session_key!)))
    }
  }

  const updateRounds = (n: number) => {
    const clamped = Math.max(1, Math.min(5, n))
    setNumRounds(clamped)
    // Adjust topics array
    const newTopics = [...topics]
    while (newTopics.length < clamped) {
      newTopics.push(DEFAULT_TOPICS[newTopics.length] || `Round ${newTopics.length + 1}`)
    }
    setTopics(newTopics.slice(0, clamped))
  }

  const updateTopic = (idx: number, value: string) => {
    setTopics(prev => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }

  const handleStart = async () => {
    if (selectedAgents.size < 2) {
      setError('Select at least 2 participants')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onStart({
        title: goal ? `Meeting: ${goal}` : 'Daily Standup',
        goal: goal || 'Team sync',
        room_id: roomId,
        project_id: projectId,
        participants: Array.from(selectedAgents),
        num_rounds: numRounds,
        round_topics: topics,
      })
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start meeting')
    } finally {
      setLoading(false)
    }
  }

  // Meeting already in progress view
  if (meetingInProgress) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ Meeting in Progress</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A stand-up meeting is already running in this room. View it or wait for it to complete.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {onViewProgress && (
              <Button onClick={() => { onViewProgress(); onOpenChange(false) }}>
                View Progress
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // No agents available
  if (availableAgents.length < 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ Not Enough Bots</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Assign at least 2 bots to this room to start a stand-up meeting.
          </p>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Start Stand-Up Meeting</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Meeting Goal */}
          <div className="space-y-1.5">
            <Label htmlFor="meeting-goal">Meeting Goal</Label>
            <Input
              id="meeting-goal"
              placeholder="Daily standup for development progress"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Participants</Label>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={toggleAll}
              >
                {selectedAgents.size === availableAgents.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="border rounded-md p-2 space-y-1 max-h-40 overflow-y-auto">
              {availableAgents.map(runtime => {
                const key = runtime.agent.agent_session_key!
                const checked = selectedAgents.has(key)
                return (
                  <label
                    key={runtime.agent.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAgent(key)}
                      className="rounded"
                    />
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: runtime.agent.color || '#6366f1' }}
                    />
                    <span className="text-sm font-medium">
                      {runtime.agent.icon} {runtime.agent.name}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {runtime.status}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Rounds */}
          <div className="space-y-1.5">
            <Label htmlFor="num-rounds">Rounds</Label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateRounds(numRounds - 1)}
                disabled={numRounds <= 1}
              >
                −
              </Button>
              <span className="text-sm font-mono w-6 text-center">{numRounds}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateRounds(numRounds + 1)}
                disabled={numRounds >= 5}
              >
                +
              </Button>
            </div>
          </div>

          {/* Round Topics */}
          <div className="space-y-1.5">
            <Label>Round Topics</Label>
            <div className="space-y-2">
              {topics.map((topic, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 flex-shrink-0">
                    {i + 1}.
                  </span>
                  <Input
                    value={topic}
                    onChange={(e) => updateTopic(i, e.target.value)}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Project (read-only) */}
          {projectName && (
            <div className="text-xs text-muted-foreground">
              Project: <span className="font-medium">{projectName}</span> (auto-detected from room)
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={loading || selectedAgents.size < 2}>
            {loading ? 'Starting…' : 'Start Meeting ▶'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

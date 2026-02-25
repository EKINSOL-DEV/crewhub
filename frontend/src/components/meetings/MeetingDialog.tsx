/**
 * MeetingDialog — Configuration dialog for starting a new AI meeting.
 *
 * Tabbed interface: [New Meeting] [History]
 * Supports follow-up meetings (F4) and history browsing (F5).
 */

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { AgentRuntime } from '@/hooks/useAgentsRegistry'
import type { StartMeetingParams } from '@/hooks/useMeeting'
import { useProjectMarkdownFiles } from '@/hooks/useProjectMarkdownFiles'
import { DocumentSelectorModal } from './DocumentSelectorModal'
import { DocumentUploadZone } from './DocumentUploadZone'
import { MeetingHistoryBrowser } from './MeetingHistoryBrowser'

// ─── Types ──────────────────────────────────────────────────────

export interface FollowUpContext {
  parentMeetingId: string
  title: string
  goal: string
  participants: string[]
  roomId?: string
  projectId?: string
}

interface MeetingDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly agents: AgentRuntime[]
  readonly roomId?: string
  readonly projectId?: string
  readonly projectName?: string
  readonly onStart: (params: StartMeetingParams) => Promise<void>
  readonly meetingInProgress?: boolean
  readonly onViewProgress?: () => void
  /** F4: Pre-fill for follow-up meeting */
  readonly followUpContext?: FollowUpContext | null
  /** F5: View results of a meeting */
  readonly onViewResults?: (meetingId: string) => void
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
  followUpContext,
  onViewResults,
}: MeetingDialogProps) {
  const [activeTab, setActiveTab] = useState('new')
  const [topic, setTopic] = useState('')
  const [numRounds, setNumRounds] = useState(3)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [documentPath, setDocumentPath] = useState<string>('')
  const [documentContext, setDocumentContext] = useState<string>('')
  const [showDocModal, setShowDocModal] = useState(false)
  const [parentMeetingId, setParentMeetingId] = useState<string | null>(null)

  const { refetch: refetchFiles } = useProjectMarkdownFiles(projectId)

  const availableAgents = useMemo(() => agents.filter((a) => a.agent.agent_session_key), [agents])

  // Initialize when dialog opens
  const prevOpenRef = useRef(false)
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      // Check for follow-up context
      if (followUpContext) {
        setTopic(`Follow-up: ${followUpContext.goal || followUpContext.title}`)
        setParentMeetingId(followUpContext.parentMeetingId)
        // Pre-select participants that are available
        const available = new Set(availableAgents.map((a) => a.agent.agent_session_key!))
        const preselected = new Set(followUpContext.participants.filter((p) => available.has(p)))
        setSelectedAgents(preselected.size >= 2 ? preselected : new Set())
        setActiveTab('new')
      } else {
        setSelectedAgents(new Set())
        setTopic('')
        setParentMeetingId(null)
        setActiveTab('new')
      }
      setNumRounds(3)
      setDocumentPath('')
      setDocumentContext('')
      setError(null)
    }
    prevOpenRef.current = open
  }, [open, availableAgents, followUpContext])

  const toggleAgent = (key: string) => {
    setSelectedAgents((prev) => {
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
      setSelectedAgents(new Set(availableAgents.map((a) => a.agent.agent_session_key!)))
    }
  }

  const updateRounds = (n: number) => setNumRounds(Math.max(1, Math.min(5, n)))

  const handleStart = async () => {
    if (selectedAgents.size < 2) {
      setError('Select at least 2 participants')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const meetingTopic = topic || 'Team sync'
      const roundTopics = Array.from({ length: numRounds }, (_, i) =>
        numRounds > 1 ? `${meetingTopic} - Round ${i + 1}` : meetingTopic
      )

      await onStart({
        title: topic ? `Meeting: ${topic}` : 'Team Meeting',
        goal: meetingTopic,
        room_id: roomId,
        project_id: projectId,
        participants: Array.from(selectedAgents),
        num_rounds: numRounds,
        round_topics: roundTopics,
        document_path: documentPath || undefined,
        document_context: documentContext || undefined,
        parent_meeting_id: parentMeetingId || undefined,
      })
      onOpenChange(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start meeting')
    } finally {
      setLoading(false)
    }
  }

  // F5: History action handlers
  const handleHistoryViewResults = (meetingId: string) => {
    onViewResults?.(meetingId)
    onOpenChange(false)
  }

  const handleHistoryFollowUp = (meetingId: string) => {
    // Switch to new meeting tab with follow-up context
    setParentMeetingId(meetingId)
    setTopic(`Follow-up meeting`)
    setActiveTab('new')
  }

  const handleHistoryReuse = (meeting: any) => {
    setTopic(meeting.goal || meeting.title || '')
    setParentMeetingId(null) // Not a follow-up, just reusing setup
    setActiveTab('new')
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
            A meeting is already running in this room. View it or wait for it to complete.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {onViewProgress && (
              <Button
                onClick={() => {
                  onViewProgress()
                  onOpenChange(false)
                }}
              >
                View Progress
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // No agents
  if (availableAgents.length < 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>⚠️ Not Enough Bots</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Assign at least 2 bots to this room to start a meeting.
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
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Meetings</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="new" className="flex-1">
              New Meeting
            </TabsTrigger>
            <TabsTrigger value="history" className="flex-1">
              History
            </TabsTrigger>
          </TabsList>

          {/* ─── New Meeting Tab ─── */}
          <TabsContent value="new">
            <div className="space-y-4 py-2">
              {/* Follow-up indicator */}
              {parentMeetingId && (
                <div className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 p-2 rounded flex items-center justify-between">
                  <span>🔄 Follow-up from previous meeting</span>
                  <button
                    className="text-xs hover:underline"
                    onClick={() => setParentMeetingId(null)}
                  >
                    ✕ Clear
                  </button>
                </div>
              )}

              {/* Meeting Topic */}
              <div className="space-y-1.5">
                <Label htmlFor="meeting-topic">Meeting Topic</Label>
                <Textarea
                  id="meeting-topic"
                  placeholder="What should we discuss?"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={5}
                  className="resize-y"
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
                  {availableAgents.map((runtime) => {
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

              {/* Document Selector */}
              {projectId && (
                <div className="space-y-3">
                  <Label>Optional: Attach Document</Label>
                  <div className="space-y-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      onClick={() => setShowDocModal(true)}
                    >
                      {documentPath ? (
                        <span className="truncate">📄 {documentPath}</span>
                      ) : (
                        <span className="text-muted-foreground">
                          Select document from project...
                        </span>
                      )}
                    </Button>
                    {documentPath && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-6"
                        onClick={() => setDocumentPath('')}
                      >
                        ✕ Clear selection
                      </Button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Or upload new:</Label>
                    <DocumentUploadZone
                      projectId={projectId}
                      onUploadComplete={(path) => {
                        setDocumentPath(path)
                        refetchFiles()
                      }}
                    />
                  </div>
                </div>
              )}

              {projectId && (
                <DocumentSelectorModal
                  open={showDocModal}
                  onOpenChange={setShowDocModal}
                  projectId={projectId}
                  projectName={projectName}
                  onSelect={(path) => setDocumentPath(path)}
                />
              )}

              {documentPath && (
                <div className="space-y-1.5">
                  <Label htmlFor="document-context">Additional context (before document)</Label>
                  <Textarea
                    id="document-context"
                    placeholder="Add intro, questions, or focus areas..."
                    value={documentContext}
                    onChange={(e) => setDocumentContext(e.target.value)}
                    className="text-sm"
                    rows={3}
                  />
                </div>
              )}

              {projectName && (
                <div className="text-xs text-muted-foreground">
                  Project: <span className="font-medium">{projectName}</span>
                </div>
              )}

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                  {error}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button onClick={handleStart} disabled={loading || selectedAgents.size < 2}>
                  {loading
                    ? 'Starting…'
                    : parentMeetingId
                      ? 'Start Follow-up ▶'
                      : 'Start Meeting ▶'}
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>

          {/* ─── History Tab ─── */}
          <TabsContent value="history">
            <MeetingHistoryBrowser
              roomId={roomId}
              projectId={projectId}
              onViewResults={handleHistoryViewResults}
              onFollowUp={handleHistoryFollowUp}
              onReuseSetup={handleHistoryReuse}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

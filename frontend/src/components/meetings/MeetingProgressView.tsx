/**
 * MeetingProgressView — Live progress panel for an active meeting.
 *
 * Shows round/turn tracking, live transcript, progress bar, and cancel button.
 * Designed to replace the right-side panel during an active meeting.
 */

import { useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MeetingProgressBar } from './MeetingProgressBar'
import type { MeetingState, MeetingRound, MeetingTurn } from '@/hooks/useMeeting'

interface MeetingProgressViewProps {
  meeting: MeetingState
  onCancel: () => void
  onViewOutput: () => void
}

function TurnEntry({ turn }: { turn: MeetingTurn }) {
  const statusIcon =
    turn.status === 'done'
      ? '✓'
      : turn.status === 'speaking'
        ? '●'
        : turn.status === 'skipped'
          ? '⊘'
          : '○'

  const statusLabel =
    turn.status === 'done'
      ? 'Completed'
      : turn.status === 'speaking'
        ? 'Speaking'
        : turn.status === 'skipped'
          ? 'Skipped'
          : 'Waiting'

  const statusColor =
    turn.status === 'done'
      ? 'text-green-500'
      : turn.status === 'speaking'
        ? 'text-blue-500 animate-pulse'
        : turn.status === 'skipped'
          ? 'text-orange-400'
          : 'text-muted-foreground'

  return (
    <div className="py-2 border-b border-border/40 last:border-0">
      <div className="flex items-start gap-2">
        <span className={`text-sm mt-0.5 ${statusColor}`} aria-label={statusLabel} role="img">{statusIcon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{turn.agentName}</span>
          {turn.status === 'speaking' && (
            <span className="text-xs text-blue-400 ml-2">generating…</span>
          )}
          {turn.status === 'waiting' && (
            <span className="text-xs text-muted-foreground ml-2">waiting</span>
          )}
          {turn.response && (
            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
              {turn.response}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function RoundSection({ round }: { round: MeetingRound }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        Round {round.roundNum}: {round.topic}
      </div>
      {round.turns.map((turn, i) => (
        <TurnEntry key={`${turn.agentId}-${turn.round}-${i}`} turn={turn} />
      ))}
    </div>
  )
}

export function MeetingProgressView({
  meeting,
  onCancel,
  onViewOutput,
}: MeetingProgressViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') || scrollRef.current
      el.scrollTop = el.scrollHeight
    }
  }, [meeting.rounds])

  const isFinished = meeting.phase === 'complete' || meeting.phase === 'error' || meeting.phase === 'cancelled'

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            📋 {meeting.title || 'Meeting'}
          </h3>
          {meeting.phase === 'gathering' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              Gathering
            </span>
          )}
          {meeting.phase === 'synthesizing' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
              Synthesizing
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <MeetingProgressBar
            progressPct={meeting.progressPct}
            currentRound={meeting.currentRound}
            totalRounds={meeting.totalRounds}
            currentTurnAgentName={meeting.currentTurnAgentName}
            phase={meeting.phase}
          />
        </div>
      </div>

      {/* Transcript */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-2">
        {meeting.phase === 'gathering' && (
          <div className="text-sm text-muted-foreground text-center py-8">
            <div className="text-2xl mb-2">🚶‍♂️</div>
            Bots are gathering at the meeting table…
          </div>
        )}

        {meeting.rounds.map((round, i) => (
          <RoundSection key={i} round={round} />
        ))}

        {meeting.phase === 'synthesizing' && (
          <div className="text-sm text-muted-foreground text-center py-4">
            <div className="text-lg mb-1">⚡</div>
            Generating meeting summary…
          </div>
        )}

        {meeting.warnings && meeting.warnings.length > 0 && (
          <div className="space-y-1 mt-2">
            {meeting.warnings.map((w, i) => (
              <div key={i} className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 p-2 rounded">
                ⚠️ {w}
              </div>
            ))}
          </div>
        )}

        {meeting.phase === 'error' && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded mt-2">
            ⚠️ {meeting.error || 'An error occurred'}
          </div>
        )}

        {meeting.phase === 'cancelled' && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Meeting was cancelled.
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t flex items-center gap-2">
        {meeting.phase === 'complete' ? (
          <Button className="w-full" onClick={onViewOutput}>
            ✅ View Results
          </Button>
        ) : isFinished ? (
          <Button variant="outline" className="w-full" onClick={onViewOutput}>
            Close
          </Button>
        ) : (
          <Button variant="destructive" className="w-full" onClick={onCancel}>
            ⏹ Cancel Meeting
          </Button>
        )}
      </div>
    </div>
  )
}

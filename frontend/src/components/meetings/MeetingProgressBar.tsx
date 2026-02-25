/**
 * MeetingProgressBar — Visual progress bar with percentage,
 * current round/total, and current turn.
 */

interface MeetingProgressBarProps {
  progressPct: number
  currentRound: number
  totalRounds: number
  currentTurnAgentName?: string | null
  phase: string
}

export function MeetingProgressBar({
  progressPct,
  currentRound,
  totalRounds,
  currentTurnAgentName,
  phase,
}: MeetingProgressBarProps) {
  const pct = Math.min(100, Math.max(0, progressPct))

  let label = ''
  if (phase === 'gathering') label = 'Gathering…'
  else if (phase === 'synthesizing') label = 'Generating summary…'
  else if (phase === 'complete') label = 'Complete'
  else if (phase === 'round' && currentRound > 0) {
    label = `Round ${currentRound}/${totalRounds}`
    if (currentTurnAgentName) label += ` · ${currentTurnAgentName} speaking`
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div
        className="h-2 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Meeting progress: ${Math.round(pct)}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background:
              phase === 'complete' ? '#22c55e' : phase === 'synthesizing' ? '#f59e0b' : '#6366f1',
          }}
        />
      </div>
    </div>
  )
}

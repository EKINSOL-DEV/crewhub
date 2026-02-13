/**
 * MeetingOutput — Final results view after meeting completes.
 *
 * Renders markdown summary, provides copy/open actions,
 * and a toggle between summary and full transcript.
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { MeetingState, MeetingRound } from '@/hooks/useMeeting'

interface MeetingOutputProps {
  meeting: MeetingState
  onClose: () => void
  onRetryFetch?: () => Promise<unknown>
  outputLoading?: boolean
  outputError?: string | null
}

function FullTranscript({ rounds }: { rounds: MeetingRound[] }) {
  return (
    <div className="space-y-4">
      {rounds.map((round) => (
        <div key={round.roundNum}>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1 mb-2">
            Round {round.roundNum}: {round.topic}
          </div>
          {round.turns.map((turn, i) => (
            <div key={i} className="mb-3">
              <div className="text-sm font-medium">{turn.agentName}:</div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-0.5">
                {turn.response || '(no response)'}
              </p>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function MeetingOutput({ meeting, onClose, onRetryFetch, outputLoading, outputError }: MeetingOutputProps) {
  const [showTranscript, setShowTranscript] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const text = meeting.outputMd || 'No output available'
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [meeting.outputMd])

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            ✅ Meeting Complete — {dateStr}
          </h3>
          {!showTranscript ? (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setShowTranscript(true)}
            >
              Full Transcript
            </button>
          ) : (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setShowTranscript(false)}
            >
              Summary
            </button>
          )}
        </div>
        {meeting.durationSeconds && (
          <div className="text-xs text-muted-foreground mt-1">
            Duration: {Math.round(meeting.durationSeconds)}s
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 px-4 py-3">
        {showTranscript ? (
          <FullTranscript rounds={meeting.rounds} />
        ) : meeting.outputMd ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {/* Simple markdown rendering — just split by headers for now */}
            {meeting.outputMd.split('\n').map((line, i) => {
              if (line.startsWith('# ')) {
                return <h1 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(2)}</h1>
              }
              if (line.startsWith('## ')) {
                return <h2 key={i} className="text-base font-semibold mt-3 mb-1.5">{line.slice(3)}</h2>
              }
              if (line.startsWith('### ')) {
                return <h3 key={i} className="text-sm font-semibold mt-2 mb-1">{line.slice(4)}</h3>
              }
              if (line.startsWith('- [ ] ')) {
                return <div key={i} className="flex items-start gap-1.5 ml-2"><input type="checkbox" disabled className="mt-1" /><span className="text-sm">{line.slice(6)}</span></div>
              }
              if (line.startsWith('- ')) {
                return <div key={i} className="text-sm ml-2">• {line.slice(2)}</div>
              }
              if (line.trim() === '') return <div key={i} className="h-2" />
              return <p key={i} className="text-sm text-muted-foreground">{line}</p>
            })}
          </div>
        ) : outputError ? (
          <div className="text-center py-8 space-y-3">
            <div className="text-sm text-destructive">⚠️ {outputError}</div>
            {onRetryFetch && (
              <Button variant="outline" size="sm" onClick={() => onRetryFetch()}>
                🔄 Retry
              </Button>
            )}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-8">
            {outputLoading ? 'Loading output…' : 'Loading output…'}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-3 border-t space-y-2">
        {meeting.outputPath && (
          <div className="text-xs text-muted-foreground truncate">
            💾 Saved to: {meeting.outputPath}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? '✓ Copied' : '📋 Copy'}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

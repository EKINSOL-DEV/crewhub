/**
 * StepClaudeDetect — detect Claude Code CLI installation.
 */

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2, RefreshCw, ArrowRight } from 'lucide-react'
import { detectClaudeCode, type ClaudeCodeDetectResult } from '@/lib/api'

interface StepClaudeDetectProps {
  readonly onContinue: () => void
}

export function StepClaudeDetect({ onContinue }: StepClaudeDetectProps) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ClaudeCodeDetectResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const detect = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await detectClaudeCode()
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Detection failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    detect()
  }, [detect])

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Detecting Claude Code</h2>
        <p className="text-muted-foreground">Looking for the Claude Code CLI on your system...</p>
      </div>

      <div className="max-w-md mx-auto rounded-xl border-2 bg-card p-8">
        {loading && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-[#8B5CF6]" />
            <p className="text-muted-foreground">Scanning...</p>
          </div>
        )}

        {!loading && result?.found && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div>
              <p className="font-semibold text-lg text-green-600">Claude Code Found!</p>
              <p className="text-sm text-muted-foreground mt-1">
                CLI path:{' '}
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{result.cli_path}</code>
              </p>
              {result.session_count > 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  {result.session_count} existing session{result.session_count !== 1 ? 's' : ''}{' '}
                  found
                </p>
              )}
            </div>
            <Button onClick={onContinue} className="gap-2 mt-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {!loading && result && !result.found && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-12 w-12 text-red-500" />
            <div>
              <p className="font-semibold text-lg text-red-600">Claude Code Not Found</p>
              <p className="text-sm text-muted-foreground mt-2">Install it with:</p>
              <code className="block bg-muted px-3 py-2 rounded text-xs mt-2">
                npm install -g @anthropic-ai/claude-code
              </code>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={detect} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Retry
              </Button>
              <Button variant="ghost" onClick={onContinue}>
                Skip for now
              </Button>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-12 w-12 text-yellow-500" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={detect} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

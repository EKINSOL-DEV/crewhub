import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Zap,
  Terminal,
  ExternalLink,
} from 'lucide-react'
import { getRuntimeIcon, getRuntimeLabel, getStatusBadge } from '../onboardingHelpers'
import type { DiscoveryCandidate, ScanResult } from '@/lib/api'

interface StepScanProps {
  readonly scanning: boolean
  readonly scanResult: ScanResult | null
  readonly candidates: DiscoveryCandidate[]
  readonly onScanAgain: () => void
  readonly onConnect: (candidate: DiscoveryCandidate, index: number) => void
  readonly onContinue: () => void
  readonly onDemo: () => void
}

export function StepScan({
  scanning,
  scanResult,
  candidates,
  onScanAgain,
  onConnect,
  onContinue,
  onDemo,
}: StepScanProps) {
  const reachableCount = candidates.filter((c) => c.status === 'reachable').length
  const nothingFound = !scanning && scanResult && candidates.length === 0

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">
          {(() => {
            if (scanning) return 'Scanning for agent runtimes…'
            return nothingFound ? 'No runtimes found' : 'Discovery Results'
          })()}
        </h2>
        {scanning && (
          <p className="text-muted-foreground">Checking localhost ports, config files, and CLIs…</p>
        )}
        {scanResult && !scanning && (
          <p className="text-muted-foreground text-sm">
            Scan completed in {scanResult.scan_duration_ms}ms
          </p>
        )}
      </div>

      {scanning && (
        <div className="flex items-center justify-center py-12">
          <div className="relative">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <Search className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
        </div>
      )}

      {!scanning && candidates.length > 0 && (
        <div className="space-y-3">
          {candidates.map((candidate, index) => (
            <div
              key={JSON.stringify(candidate)}
              className="p-4 rounded-xl border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10 text-primary shrink-0">
                  {getRuntimeIcon(candidate.runtime_type)}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{getRuntimeLabel(candidate.runtime_type)}</span>
                    {getStatusBadge(candidate.status)}
                    {candidate.confidence !== 'high' && (
                      <Badge variant="outline" className="text-[10px]">
                        {candidate.confidence} confidence
                      </Badge>
                    )}
                  </div>
                  {candidate.target.url && (
                    <p className="text-sm text-muted-foreground font-mono">
                      {candidate.target.url}
                    </p>
                  )}
                  {candidate.metadata.active_sessions !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      {candidate.metadata.active_sessions} active session
                      {candidate.metadata.active_sessions === 1 ? '' : 's'}
                    </p>
                  )}
                  {candidate.metadata.version && (
                    <p className="text-xs text-muted-foreground">
                      Version: {candidate.metadata.version}
                    </p>
                  )}
                  {candidate.evidence.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {candidate.evidence.map((ev, _ei) => (
                        <span
                          key={JSON.stringify(ev)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {(() => {
                    if (candidate.status === 'reachable') {
                      return (
                        <Button
                          size="sm"
                          onClick={() => onConnect(candidate, index)}
                          className="gap-1.5"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Connect
                        </Button>
                      )
                    }

                    if (candidate.status === 'installed') {
                      return (
                        <Button variant="outline" size="sm" className="gap-1.5" asChild>
                          <a
                            href={`https://docs.crewhub.dev/runtimes/${candidate.runtime_type}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> How to enable
                          </a>
                        </Button>
                      )
                    }

                    return null
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {nothingFound && (
        <div className="space-y-6 py-4">
          <div className="p-6 rounded-xl border bg-card text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Search className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">No agent runtimes detected</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                We checked your local machine but didn't find any running agent runtimes.
              </p>
            </div>
            <div className="grid gap-3 max-w-md mx-auto text-left">
              <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-3">
                <Zap className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Start OpenClaw</p>
                  <p className="text-xs text-muted-foreground">
                    Run{' '}
                    <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                      openclaw gateway start
                    </code>{' '}
                    in your terminal
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-3">
                <Terminal className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">Install Claude Code</p>
                  <p className="text-xs text-muted-foreground">
                    Visit{' '}
                    <a
                      href="https://docs.anthropic.com/claude-code"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-foreground"
                    >
                      docs.anthropic.com/claude-code
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={onScanAgain}
          disabled={scanning}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
          Scan again
        </Button>
        <div className="flex items-center gap-2">
          {nothingFound && (
            <Button variant="outline" onClick={onDemo} className="gap-2">
              <Sparkles className="h-4 w-4" /> Use demo data
            </Button>
          )}
          {reachableCount > 0 && (
            <Button onClick={onContinue} className="gap-2">
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

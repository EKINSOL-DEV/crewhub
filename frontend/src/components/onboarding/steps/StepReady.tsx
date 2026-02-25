import { Button } from '@/components/ui/button'
import { Rocket, Sparkles, CheckCircle2 } from 'lucide-react'
import { getRuntimeIcon } from '../onboardingHelpers'
import type { ConnectionConfig } from '../onboardingTypes'

interface StepReadyProps {
  readonly connections: ConnectionConfig[]
  readonly onGoDashboard: () => void
}

export function StepReady({ connections, onGoDashboard }: StepReadyProps) {
  const enabledConnections = connections.filter((c) => c.enabled)
  const totalSessions = enabledConnections.reduce((sum, c) => sum + (c.sessions ?? 0), 0)

  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-8">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <Rocket className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <div className="absolute -top-1 -right-1">
          <Sparkles className="h-6 w-6 text-green-500 animate-pulse" />
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold">You're all set!</h2>
        <p className="text-muted-foreground text-lg">CrewHub is ready to monitor your agents.</p>
      </div>

      {enabledConnections.length > 0 && (
        <div className="w-full space-y-3">
          {enabledConnections.map((conn) => (
            <div key={conn.id} className="p-3 rounded-lg border bg-card flex items-center gap-3">
              <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                {getRuntimeIcon(conn.type)}
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-sm">{conn.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{conn.url}</p>
              </div>
              {conn.testStatus === 'success' && (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              )}
            </div>
          ))}
          {totalSessions > 0 && (
            <p className="text-sm text-muted-foreground">
              {totalSessions} active session{totalSessions === 1 ? '' : 's'} ready to stream
            </p>
          )}
        </div>
      )}

      {enabledConnections.length === 0 && (
        <p className="text-muted-foreground">
          No connections configured yet. You can add them anytime from Settings.
        </p>
      )}

      <Button size="lg" className="w-full gap-3 h-14 text-lg" onClick={onGoDashboard}>
        <Rocket className="h-5 w-5" /> Go to dashboard
      </Button>
    </div>
  )
}

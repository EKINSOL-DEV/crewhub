import { Button } from '@/components/ui/button'
import { Search, Zap, Cable, Sparkles } from 'lucide-react'

interface StepWelcomeProps {
  readonly onScan: () => void
  readonly onDemo: () => void
  readonly onManual: () => void
  readonly onOpenClawWizard: () => void
}

export function StepWelcome({ onScan, onDemo, onManual, onOpenClawWizard }: StepWelcomeProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-lg mx-auto space-y-8">
      <div className="relative">
        <img src="/logo.svg" alt="CrewHub" className="h-24 w-24" />
        <div className="absolute -top-2 -right-2">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" />
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to CrewHub</h1>
        <p className="text-muted-foreground text-lg">
          Monitor and orchestrate your AI agents across all runtimes.
        </p>
      </div>

      <div className="w-full space-y-3">
        <Button size="lg" className="w-full gap-3 h-14 text-lg" onClick={onOpenClawWizard}>
          <Zap className="h-5 w-5" />
          Connect to OpenClaw
        </Button>
        <Button variant="outline" size="lg" className="w-full gap-3 h-12" onClick={onScan}>
          <Search className="h-5 w-5" />
          Auto-scan for agents
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="lg"
            className="flex-1 gap-2 h-10 text-muted-foreground"
            onClick={onDemo}
          >
            <Sparkles className="h-4 w-4" />
            Demo mode
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="flex-1 gap-2 h-10 text-muted-foreground"
            onClick={onManual}
          >
            <Cable className="h-4 w-4" />
            Manual setup
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground max-w-sm">
        We'll only scan your computer by default. LAN scanning requires permission.
      </p>
    </div>
  )
}

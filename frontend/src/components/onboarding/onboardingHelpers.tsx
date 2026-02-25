import { Badge } from '@/components/ui/badge'
import { Zap, Terminal, Bot, Cable, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import type { DiscoveryCandidate } from '@/lib/api'
import type { ConnectionConfig } from './onboardingTypes'

// ─── Runtime display helpers ────────────────────────────────────

export function getRuntimeIcon(type: string) {
  switch (type) {
    case 'openclaw':
      return <Zap className="h-5 w-5" />
    case 'claude_code':
      return <Terminal className="h-5 w-5" />
    case 'codex_cli':
      return <Bot className="h-5 w-5" />
    default:
      return <Cable className="h-5 w-5" />
  }
}

export function getRuntimeLabel(type: string) {
  switch (type) {
    case 'openclaw':
      return 'OpenClaw'
    case 'claude_code':
      return 'Claude Code'
    case 'codex_cli':
      return 'Codex CLI'
    default:
      return type
  }
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'reachable':
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800">
          <CheckCircle2 className="h-3 w-3 mr-1" /> Reachable
        </Badge>
      )
    case 'installed':
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
          <AlertCircle className="h-3 w-3 mr-1" /> Installed
        </Badge>
      )
    case 'auth_required':
      return (
        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-3 w-3 mr-1" /> Auth Required
        </Badge>
      )
    case 'unreachable':
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800">
          <XCircle className="h-3 w-3 mr-1" /> Unreachable
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary">
          <AlertCircle className="h-3 w-3 mr-1" /> Unknown
        </Badge>
      )
  }
}

export function candidateToConnection(
  candidate: DiscoveryCandidate,
  index: number
): ConnectionConfig {
  const url =
    candidate.target.url ||
    `http://${candidate.target.host || 'localhost'}:${candidate.target.port || 3000}`
  return {
    id: `discovered-${index}`,
    name: `${getRuntimeLabel(candidate.runtime_type)} (${candidate.target.host || 'local'})`,
    type: candidate.runtime_type,
    url,
    token: '',
    enabled: candidate.status === 'reachable',
    testStatus: candidate.status === 'reachable' ? 'success' : 'idle',
    sessions: candidate.metadata.active_sessions,
  }
}

import type { MinionSession } from '@/lib/api'
import { getSessionStatus, getSessionCost, formatCost } from '@/lib/minionUtils'

interface StatsHeaderProps {
  readonly sessions: MinionSession[]
}

export function StatsHeader({ sessions }: StatsHeaderProps) {
  const activeCount = sessions.filter((s) => getSessionStatus(s, sessions) === 'active').length
  const supervisingCount = sessions.filter(
    (s) => getSessionStatus(s, sessions) === 'supervising'
  ).length
  const idleCount = sessions.filter((s) => getSessionStatus(s, sessions) === 'idle').length
  const sleepingCount = sessions.filter((s) => getSessionStatus(s, sessions) === 'sleeping').length

  const totalTokens = sessions.reduce((sum, s) => sum + (s.totalTokens || 0), 0)
  const totalCost = sessions.reduce((sum, s) => sum + getSessionCost(s), 0)

  return (
    <div className="flex items-center gap-6 px-4 py-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-lg">👥</span>
        <span className="text-sm font-medium">{sessions.length} Agents</span>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <span className="text-green-500">●</span>
          <span>{activeCount} active</span>
        </div>
        {supervisingCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-purple-500">●</span>
            <span>{supervisingCount} supervising</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="text-yellow-500">●</span>
          <span>{idleCount} idle</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-gray-400">●</span>
          <span>{sleepingCount} sleeping</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
        <span>{totalTokens.toLocaleString()} tokens</span>
        {totalCost > 0 && <span>{formatCost(totalCost)}</span>}
      </div>
    </div>
  )
}

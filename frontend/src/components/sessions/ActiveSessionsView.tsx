import type { CrewSession } from '@/lib/api'
import { SessionCard } from './SessionCard'
import { EmptyState } from './EmptyState'

interface ActiveSessionsViewProps {
  readonly sessions: CrewSession[]
  readonly onSessionClick?: (session: CrewSession) => void
}

export function ActiveSessionsView({ sessions, onSessionClick }: ActiveSessionsViewProps) {
  if (sessions.length === 0) {
    return <EmptyState />
  }

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((session) => (
          <SessionCard
            key={session.key}
            session={session}
            onViewLogs={() => onSessionClick?.(session)}
          />
        ))}
      </div>
    </div>
  )
}

// Backwards compatibility alias
export { ActiveSessionsView as ActiveMinionsView }

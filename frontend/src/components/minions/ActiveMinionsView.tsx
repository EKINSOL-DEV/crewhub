import type { MinionSession } from "@/lib/api"
import { MinionCard } from "./MinionCard"
import { EmptyState } from "./EmptyState"

interface ActiveMinionsViewProps {
  sessions: MinionSession[]
  onMinionClick?: (session: MinionSession) => void
}

export function ActiveMinionsView({ sessions, onMinionClick }: ActiveMinionsViewProps) {
  if (sessions.length === 0) {
    return <EmptyState />
  }

  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((session) => (
          <MinionCard
            key={session.key}
            session={session}
            onViewLogs={() => onMinionClick?.(session)}
          />
        ))}
      </div>
    </div>
  )
}

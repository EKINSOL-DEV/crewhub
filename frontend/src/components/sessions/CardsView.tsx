import { useState, useMemo, useCallback } from 'react'
import { type CrewSession } from '@/lib/api'
import { SessionCard } from './SessionCard'
import { LogViewer } from './LogViewer'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, SlidersHorizontal, ChevronRight, Layers } from 'lucide-react'
import { getSessionStatus, type SessionStatus } from '@/lib/minionUtils'
import { useRooms } from '@/hooks/useRooms'
import { cn } from '@/lib/utils'

interface CardsViewProps {
  readonly sessions: CrewSession[]
}

type SortOption = 'recent' | 'name' | 'tokens' | 'status'
type StatusFilter = 'active' | 'supervising' | 'idle' | 'sleeping'
const ALL_STATUSES: StatusFilter[] = ['active', 'supervising', 'idle', 'sleeping']
const DEFAULT_FILTERS: Set<StatusFilter> = new Set(['active', 'supervising', 'idle'])

function getDisplayName(session: CrewSession): string {
  if (session.displayName) return session.displayName
  if (session.label) return session.label
  const key = session.key
  const parts = key.split(':')
  if (parts.length >= 3) {
    if (parts[1] === 'main') return 'Main Agent'
    if (parts[1] === 'cron') return `Cron: ${parts[2]}`
    if (parts[1] === 'subagent' || parts[1] === 'spawn')
      return `Subagent: ${parts[2].substring(0, 8)}`
    return parts.slice(1).join(':')
  }
  return key
}

const sortLabels: Record<SortOption, string> = {
  recent: 'Most Recent',
  name: 'Name',
  tokens: 'Tokens',
  status: 'Status',
}

const filterLabels: Record<StatusFilter, string> = {
  active: 'Active',
  supervising: 'Supervising',
  idle: 'Idle',
  sleeping: 'Sleeping',
}

const statusOrder: Record<SessionStatus, number> = {
  active: 0,
  supervising: 1,
  idle: 2,
  sleeping: 3,
}

/** Collapsible room group header */
function RoomGroupHeader({
  name,
  icon,
  color,
  count,
  expanded,
  onToggle,
}: {
  name: string
  icon: string | null
  color: string | null
  count: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card/80 hover:bg-accent/30 transition-colors text-left"
    >
      <ChevronRight
        className={cn(
          'h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0',
          expanded && 'rotate-90'
        )}
      />
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center text-base shrink-0"
        style={{
          backgroundColor: `${color || '#6b7280'}15`,
          border: `2px solid ${color || '#6b7280'}60`,
        }}
      >
        {icon || '📦'}
      </div>
      <span className="font-medium text-sm flex-1">{name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {count} session{count === 1 ? '' : 's'}
      </span>
    </button>
  )
}

export function CardsView({ sessions }: CardsViewProps) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [activeFilters, setActiveFilters] = useState<Set<StatusFilter>>(new Set(DEFAULT_FILTERS))
  const [selectedSession, setSelectedSession] = useState<CrewSession | null>(null)
  const [logViewerOpen, setLogViewerOpen] = useState(false)
  const [groupByRoom, setGroupByRoom] = useState(true)
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set())

  const { rooms, getRoomForSession } = useRooms()

  const allSelected = activeFilters.size === ALL_STATUSES.length

  const toggleFilter = useCallback((status: StatusFilter) => {
    setActiveFilters((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setActiveFilters((prev) =>
      prev.size === ALL_STATUSES.length ? new Set<StatusFilter>() : new Set(ALL_STATUSES)
    )
  }, [])

  const toggleRoomCollapse = useCallback((roomId: string) => {
    setCollapsedRooms((prev) => {
      const next = new Set(prev)
      if (next.has(roomId)) {
        next.delete(roomId)
      } else {
        next.add(roomId)
      }
      return next
    })
  }, [])

  const filteredAndSortedSessions = useMemo(() => {
    let result = [...sessions]

    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.key.toLowerCase().includes(searchLower) ||
          s.label?.toLowerCase().includes(searchLower) ||
          s.displayName?.toLowerCase().includes(searchLower) ||
          s.model?.toLowerCase().includes(searchLower)
      )
    }

    // Filter by status (if not all selected, apply filter)
    if (activeFilters.size > 0 && activeFilters.size < ALL_STATUSES.length) {
      result = result.filter((s) => activeFilters.has(getSessionStatus(s) as StatusFilter))
    } else if (activeFilters.size === 0) {
      result = []
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return b.updatedAt - a.updatedAt
        case 'name':
          return getDisplayName(a).localeCompare(getDisplayName(b))
        case 'tokens':
          return (b.totalTokens || 0) - (a.totalTokens || 0)
        case 'status':
          return statusOrder[getSessionStatus(a)] - statusOrder[getSessionStatus(b)]
        default:
          return 0
      }
    })

    return result
  }, [sessions, search, sortBy, activeFilters])

  // Group sessions by room when groupByRoom is enabled
  const groupedSessions = useMemo(() => {
    // NOSONAR: complexity from React render with multiple view state branches
    if (!groupByRoom) return null

    const groups = new Map<
      string,
      {
        room: {
          id: string
          name: string
          icon: string | null
          color: string | null
          sort_order: number
        } | null
        sessions: CrewSession[]
      }
    >()

    // Create a group for each known room in sort order
    const sortedRooms = [...rooms].sort((a, b) => a.sort_order - b.sort_order)
    for (const room of sortedRooms) {
      groups.set(room.id, { room, sessions: [] })
    }

    // Place sessions into their room groups
    for (const session of filteredAndSortedSessions) {
      const roomId = getRoomForSession(session.key, {
        label: session.label,
        model: session.model,
        channel: session.lastChannel || session.channel,
      })

      if (roomId && groups.has(roomId)) {
        groups.get(roomId)!.sessions.push(session)
      } else {
        // Unassigned group
        if (!groups.has('__unassigned__')) {
          groups.set('__unassigned__', { room: null, sessions: [] })
        }
        groups.get('__unassigned__')!.sessions.push(session)
      }
    }

    // Convert to array, filter out empty groups, put unassigned last
    const result: {
      groupId: string
      name: string
      icon: string | null
      color: string | null
      sessions: CrewSession[]
    }[] = []
    for (const [groupId, { room, sessions: groupSessions }] of groups) {
      if (groupSessions.length === 0) continue
      if (groupId === '__unassigned__') continue // Add last
      result.push({
        groupId,
        name: room?.name || groupId,
        icon: room?.icon || null,
        color: room?.color || null,
        sessions: groupSessions,
      })
    }

    // Add unassigned at the end
    const unassigned = groups.get('__unassigned__')
    if (unassigned && unassigned.sessions.length > 0) {
      result.push({
        groupId: '__unassigned__',
        name: 'Unassigned',
        icon: '📦',
        color: '#6b7280',
        sessions: unassigned.sessions,
      })
    }

    return result
  }, [groupByRoom, filteredAndSortedSessions, rooms, getRoomForSession])

  const handleViewLogs = (session: CrewSession) => {
    setSelectedSession(session)
    setLogViewerOpen(true)
  }

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: sessions.length,
      active: 0,
      supervising: 0,
      idle: 0,
      sleeping: 0,
    }
    sessions.forEach((s) => {
      const status = getSessionStatus(s)
      counts[status]++
    })
    return counts
  }, [sessions])

  return (
    <div className="h-full flex flex-col view-gradient">
      {/* Header with search and filters */}
      <div className="p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search sessions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto flex-wrap">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden sm:block mr-1" />

            <button
              type="button"
              onClick={toggleAll}
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors',
                'border cursor-pointer select-none',
                allSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
            >
              All ({statusCounts.all})
            </button>

            {ALL_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => toggleFilter(status)}
                className={cn(
                  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  'border cursor-pointer select-none',
                  activeFilters.has(status)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {filterLabels[status]} ({statusCounts[status]})
              </button>
            ))}

            <div className="hidden sm:block w-px h-5 bg-border mx-1" />

            {/* Group by Room toggle */}
            <button
              type="button"
              onClick={() => setGroupByRoom((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                'border cursor-pointer select-none',
                groupByRoom
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
              title="Group sessions by room"
            >
              <Layers className="h-3 w-3" />
              Rooms
            </button>

            {/* Sort select */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground cursor-pointer"
            >
              {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                <option key={option} value={option}>
                  Sort: {sortLabels[option]}
                </option>
              ))}
            </select>
          </div>

          {/* Count */}
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {filteredAndSortedSessions.length} session
            {filteredAndSortedSessions.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredAndSortedSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <div className="text-4xl mb-4">🔍</div>
              <p>No sessions found</p>
              {!allSelected && (
                <Button
                  variant="link"
                  className="mt-2"
                  onClick={() => setActiveFilters(new Set(ALL_STATUSES))}
                >
                  Show all sessions
                </Button>
              )}
            </div>
          ) : groupByRoom && groupedSessions ? (
            // Grouped by room view
            <div className="space-y-4">
              {groupedSessions.map((group) => {
                const isCollapsed = collapsedRooms.has(group.groupId)
                return (
                  <div key={group.groupId}>
                    <RoomGroupHeader
                      name={group.name}
                      icon={group.icon}
                      color={group.color}
                      count={group.sessions.length}
                      expanded={!isCollapsed}
                      onToggle={() => toggleRoomCollapse(group.groupId)}
                    />
                    {!isCollapsed && (
                      <div
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-3 ml-1 pl-4 border-l-2"
                        style={{ borderColor: `${group.color || '#6b7280'}40` }}
                      >
                        {group.sessions.map((session) => (
                          <SessionCard
                            key={session.key}
                            session={session}
                            onViewLogs={() => handleViewLogs(session)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            // Flat view (no grouping)
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSortedSessions.map((session) => (
                <SessionCard
                  key={session.key}
                  session={session}
                  onViewLogs={() => handleViewLogs(session)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Log Viewer Dialog */}
      <LogViewer session={selectedSession} open={logViewerOpen} onOpenChange={setLogViewerOpen} />
    </div>
  )
}

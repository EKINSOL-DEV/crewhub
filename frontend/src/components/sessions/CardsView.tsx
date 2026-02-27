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
import type { Room } from '@/contexts/RoomsContext'
import { cn } from '@/lib/utils'

const CLS_BG_MUTED_50_TEXT_MUTED_FOREGROUND_BORDER =
  'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
const CLS_BG_PRIMARY_TEXT_PRIMARY_FOREGROUND_BORDE =
  'bg-primary text-primary-foreground border-primary'
const CLS_BORDER_CURSOR_POINTER_SELECT_NONE = 'border cursor-pointer select-none'
const UNASSIGNED = '__unassigned__'

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
  readonly name: string
  readonly icon: string | null
  readonly color: string | null
  readonly count: number
  readonly expanded: boolean
  readonly onToggle: () => void
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

interface SessionGroup {
  groupId: string
  name: string
  icon: string | null
  color: string | null
  sessions: CrewSession[]
}

function groupSessionsByRoom(
  sessions: CrewSession[],
  rooms: Room[],
  getRoomForSession: (
    key: string,
    data?: { label?: string; model?: string; channel?: string }
  ) => string | undefined
): SessionGroup[] {
  type RoomInfo = {
    id: string
    name: string
    icon: string | null
    color: string | null
    sort_order: number
  }
  const groups = new Map<string, { room: RoomInfo | null; sessions: CrewSession[] }>()

  for (const room of [...rooms].sort((a, b) => a.sort_order - b.sort_order)) {
    groups.set(room.id, { room, sessions: [] })
  }

  for (const session of sessions) {
    const roomId = getRoomForSession(session.key, {
      label: session.label,
      model: session.model,
      channel: session.lastChannel || session.channel,
    })

    if (roomId && groups.has(roomId)) {
      groups.get(roomId)!.sessions.push(session)
    } else {
      if (!groups.has(UNASSIGNED)) groups.set(UNASSIGNED, { room: null, sessions: [] })
      groups.get(UNASSIGNED)!.sessions.push(session)
    }
  }

  const result: SessionGroup[] = []
  for (const [groupId, { room, sessions: groupSessions }] of groups) {
    if (groupSessions.length === 0 || groupId === UNASSIGNED) continue
    result.push({
      groupId,
      name: room?.name || groupId,
      icon: room?.icon || null,
      color: room?.color || null,
      sessions: groupSessions,
    })
  }

  const unassigned = groups.get(UNASSIGNED)
  if (unassigned && unassigned.sessions.length > 0) {
    result.push({
      groupId: UNASSIGNED,
      name: 'Unassigned',
      icon: '📦',
      color: '#6b7280',
      sessions: unassigned.sessions,
    })
  }

  return result
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

  const groupedSessions = useMemo(() => {
    if (!groupByRoom) return null
    return groupSessionsByRoom(filteredAndSortedSessions, rooms, getRoomForSession)
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

  const renderCardsGrid = () => {
    if (filteredAndSortedSessions.length === 0) {
      return (
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
      )
    }
    if (groupByRoom && groupedSessions) {
      return (
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
                        onViewLogs={handleViewLogs}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )
    }
    return (
      // Flat view (no grouping)
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredAndSortedSessions.map((session) => (
          <SessionCard key={session.key} session={session} onViewLogs={handleViewLogs} />
        ))}
      </div>
    )
  }

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
                CLS_BORDER_CURSOR_POINTER_SELECT_NONE,
                allSelected
                  ? CLS_BG_PRIMARY_TEXT_PRIMARY_FOREGROUND_BORDE
                  : CLS_BG_MUTED_50_TEXT_MUTED_FOREGROUND_BORDER
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
                  CLS_BORDER_CURSOR_POINTER_SELECT_NONE,
                  activeFilters.has(status)
                    ? CLS_BG_PRIMARY_TEXT_PRIMARY_FOREGROUND_BORDE
                    : CLS_BG_MUTED_50_TEXT_MUTED_FOREGROUND_BORDER
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
                CLS_BORDER_CURSOR_POINTER_SELECT_NONE,
                groupByRoom
                  ? CLS_BG_PRIMARY_TEXT_PRIMARY_FOREGROUND_BORDE
                  : CLS_BG_MUTED_50_TEXT_MUTED_FOREGROUND_BORDER
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
        <div className="p-4">{renderCardsGrid()}</div>
      </ScrollArea>

      {/* Log Viewer Dialog */}
      <LogViewer session={selectedSession} open={logViewerOpen} onOpenChange={setLogViewerOpen} />
    </div>
  )
}
